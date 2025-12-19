import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getCroppedImg } from '../utils/canvasUtils';
import { translateImageText } from '../services/gemini';
import { detectSpeechBalloons } from '../services/detection';
import TranslationOverlay from './TranslationOverlay';
import EditModal from './EditModal';
import html2canvas from 'html2canvas';

const TranslatorWorkspace = () => {
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState();
    const [translations, setTranslations] = useState([]); // Array of { id, crop, text, textColor, backgroundColor, fontSize }
    const [loading, setLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [detections, setDetections] = useState([]);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isAutoTranslating, setIsAutoTranslating] = useState(false);

    // Settings for the next translation OR current selection
    const [targetLang, setTargetLang] = useState('English');
    const [textColor, setTextColor] = useState('#ffffff');
    const [bgColor, setBgColor] = useState('#000000');
    const [fontSize, setFontSize] = useState(14);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingText, setPendingText] = useState('');

    // Interactive state
    const [selectedId, setSelectedId] = useState(null);
    const draggingRef = useRef({ id: null, startX: 0, startY: 0, startCropX: 0, startCropY: 0 });

    const imgRef = useRef(null);
    const containerRef = useRef(null);

    const handleImageUpload = (src) => {
        setImageSrc(src);
        setCrop(undefined);
        setTranslations([]);
        setDetections([]);
        setIsModalOpen(false);
        setSelectedId(null);
    };

    const handleAutoDetect = async () => {
        if (!imageSrc) return;
        setIsDetecting(true);
        try {
            // Convert imageSrc (blob url or base64) to Blob for API
            const response = await fetch(imageSrc);
            const blob = await response.blob();

            const detectedBoxes = await detectSpeechBalloons(blob);
            setDetections(detectedBoxes);
        } catch (error) {
            alert("Detection failed: " + error.message);
        } finally {
            setIsDetecting(false);
        }
    };

    // Helper to scale API box (natural coords) to rendered image coords
    const getScaledBox = (box) => {
        if (!imgRef.current) return null;

        const naturalWidth = imgRef.current.naturalWidth;
        const naturalHeight = imgRef.current.naturalHeight;
        const width = imgRef.current.width;
        const height = imgRef.current.height;

        const scaleX = width / naturalWidth;
        const scaleY = height / naturalHeight;

        // API returns [x1, y1, x2, y2]
        const [x1, y1, x2, y2] = box;

        return {
            x: x1 * scaleX,
            y: y1 * scaleY,
            width: (x2 - x1) * scaleX,
            height: (y2 - y1) * scaleY
        };
    };

    const handleDetectionClick = async (box) => {
        const scaled = getScaledBox(box);
        if (!scaled) return;

        // Set crop to the detected zone
        const newCrop = {
            unit: 'px',
            x: scaled.x,
            y: scaled.y,
            width: scaled.width,
            height: scaled.height
        };
        setCrop(newCrop);

        // Optional: Trigger translation immediately?
        // For now, let's just select it. User can click Translate.
        // Or we can auto-trigger:
        // await handleTranslateWithCrop(newCrop);
    };

    const handleAutoTranslate = async () => {
        if (!imageSrc || !imgRef.current) return;
        setIsAutoTranslating(true);
        setLoading(true); // Block other actions

        try {
            // 1. Detect
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            const detectedBoxes = await detectSpeechBalloons(blob);
            setDetections(detectedBoxes);

            if (detectedBoxes.length === 0) {
                alert("No speech balloons detected.");
                return;
            }

            // 2. Process each box
            // We use a simple loop or Promise.all.
            // Warning: Promise.all might hit rate limits if many balloons.
            // Let's do batching or sequence if safer, but G gemini is usually ok with a few parallel.

            const newTranslations = [];

            // Using logic from handleDetectionClick + handleTranslate
            const processBox = async (box) => {
                const scaled = getScaledBox(box.box);
                if (!scaled) return null;

                const cropForCanvas = {
                    unit: 'px',
                    x: scaled.x,
                    y: scaled.y,
                    width: scaled.width,
                    height: scaled.height
                };

                try {
                    const base64Image = getCroppedImg(imgRef.current, cropForCanvas);
                    const text = await translateImageText(base64Image, targetLang);

                    return {
                        id: Date.now() + Math.random(), // Unique ID
                        crop: cropForCanvas,
                        text: text,
                        textColor: textColor,
                        backgroundColor: bgColor,
                        fontSize: fontSize
                    };
                } catch (e) {
                    console.error("Failed to translate box", e);
                    return null;
                }
            };

            // Run in parallel
            const results = await Promise.all(detectedBoxes.map(processBox));

            // Filter out failures
            const validResults = results.filter(r => r !== null);

            setTranslations(prev => [...prev, ...validResults]);

        } catch (error) {
            console.error(error);
            alert("Auto Translate failed: " + error.message);
        } finally {
            setIsAutoTranslating(false);
            setLoading(false);
        }
    };

    const handleTranslate = async () => {
        if (!crop || !imgRef.current) return;

        setLoading(true);
        try {
            const base64Image = getCroppedImg(imgRef.current, crop);
            const text = await translateImageText(base64Image, targetLang);
            setPendingText(text);
            setIsModalOpen(true);
        } catch (error) {
            console.error("Translation error details:", error);
            alert(`Translation failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyTranslation = (finalText) => {
        const newTranslation = {
            id: Date.now(),
            crop: crop,
            text: finalText,
            textColor: textColor,
            backgroundColor: bgColor,
            fontSize: fontSize
        };

        setTranslations([...translations, newTranslation]);
        setCrop(undefined); // Clear selection after applying
        setIsModalOpen(false);

        // Select the new translation immediately
        setSelectedId(newTranslation.id);
    };

    const handleDeleteTranslation = (id) => {
        setTranslations(translations.filter(t => t.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    // Update handlers that handle both default state and active selection
    const updateSetting = (key, value) => {
        if (selectedId) {
            setTranslations(translations.map(t =>
                t.id === selectedId ? { ...t, [key]: value } : t
            ));
        }
        // Always update the toolbar state
        if (key === 'textColor') setTextColor(value);
        if (key === 'backgroundColor') setBgColor(value);
        if (key === 'fontSize') setFontSize(value);
    };

    const handleOverlayClick = (id) => {
        const overlay = translations.find(t => t.id === id);
        if (overlay) {
            setSelectedId(id);
            setTextColor(overlay.textColor);
            setBgColor(overlay.backgroundColor);
            setFontSize(overlay.fontSize);
            // We don't change crop/selection when clicking an overlay, just select the overlay
            setCrop(undefined);
        }
    };

    // Dragging Logic
    const handleOverlayMouseDown = (e, id) => {
        e.stopPropagation(); // Prevent starting a new crop
        e.preventDefault(); // Prevent text selection

        const overlay = translations.find(t => t.id === id);
        if (!overlay) return;

        handleOverlayClick(id); // Select on drag start

        draggingRef.current = {
            id: id,
            startX: e.clientX,
            startY: e.clientY,
            startCropX: overlay.crop.x,
            startCropY: overlay.crop.y
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    const handleWindowMouseMove = (e) => {
        const { id, startX, startY, startCropX, startCropY } = draggingRef.current;
        if (!id) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        setTranslations(prev => prev.map(t => {
            if (t.id !== id) return t;
            return {
                ...t,
                crop: {
                    ...t.crop,
                    x: startCropX + dx,
                    y: startCropY + dy
                }
            };
        }));
    };

    const handleWindowMouseUp = () => {
        draggingRef.current = { id: null, startX: 0, startY: 0, startCropX: 0, startCropY: 0 };
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };

    // Deselect if clicking on empty space (handled by ReactCrop's container click usually,
    // but ReactCrop captures clicks. We can check if `crop` is being set.)
    // Actually, simpler: if user starts drawing a new crop, we deselect.
    useEffect(() => {
        if (crop) {
            setSelectedId(null);
        }
    }, [crop]);


    return (
        <div className="max-w-4xl mx-auto p-6" onMouseUp={handleWindowMouseUp}>
            <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Auto Web Image Translator</h1>

            {!imageSrc ? (
                <ImageUploader onImageUpload={handleImageUpload} />
            ) : (
                <div className="flex flex-col items-center">

                    {/* Toolbar */}
                    <div className="w-full flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100 flex-wrap gap-4 sticky top-0 z-20">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Language:</span>
                                <select
                                    value={targetLang}
                                    onChange={(e) => setTargetLang(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="English">English</option>
                                    <option value="Indonesian">Indonesian</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-4 items-center flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Text:</span>
                                <input
                                    type="color"
                                    value={textColor}
                                    onChange={(e) => updateSetting('textColor', e.target.value)}
                                    className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
                                    title="Text Color"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Bg:</span>
                                <input
                                    type="color"
                                    value={bgColor}
                                    onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                                    className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
                                    title="Background Color"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Size:</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={fontSize}
                                    onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                                    className="w-20 cursor-pointer"
                                    title={`Font Size: ${fontSize}px`}
                                />
                                <span className="text-xs text-gray-500 w-4">{fontSize}</span>
                            </div>

                            <div className="h-6 w-px bg-gray-300 mx-2"></div>

                            <button
                                onClick={() => setImageSrc(null)}
                                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                            >
                                New Image
                            </button>
                            <button
                                onClick={handleTranslate}
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                disabled={!crop?.width || !crop?.height || loading}
                            >
                                {loading ? 'Translating...' : 'Translate Selection'}
                            </button>
                            <button
                                onClick={handleAutoDetect}
                                className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                disabled={isDetecting || loading || !imageSrc}
                            >
                                {isDetecting ? 'Detecting...' : '✨ Auto Detect'}
                            </button>
                            <button
                                onClick={handleAutoTranslate}
                                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                disabled={isAutoTranslating || loading || !imageSrc}
                            >
                                {isAutoTranslating ? 'Processing...' : '⚡ Auto Translate'}
                            </button>
                            <button
                                onClick={async () => {
                                    if (!containerRef.current) return;
                                    setIsExporting(true); // Start clean export

                                    // Temporarily deselect overlay and detection
                                    const currentSelection = selectedId;
                                    setSelectedId(null);

                                    // Wait for render to clear UI elements
                                    await new Promise(resolve => setTimeout(resolve, 100));

                                    try {
                                        const canvas = await html2canvas(containerRef.current, {
                                            useCORS: true,
                                            scale: 2,
                                            backgroundColor: null,
                                        });

                                        const link = document.createElement('a');
                                        link.download = `translated-image-${Date.now()}.png`;
                                        link.href = canvas.toDataURL('image/png');
                                        link.click();
                                    } catch (error) {
                                        console.error("Export failed:", error);
                                        alert("Failed to export image.");
                                    } finally {
                                        // Restore state
                                        setSelectedId(currentSelection);
                                        setIsExporting(false);
                                    }
                                }}
                                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition shadow-sm flex items-center gap-2 disabled:opacity-50"
                                disabled={isExporting || !imageSrc}
                            >
                                {isExporting ? 'Exporting...' : 'Export Image'}
                            </button>
                        </div>
                    </div>

                    <div className="relative inline-block" ref={containerRef}>
                        <ReactCrop
                            crop={crop}
                            onChange={(c) => setCrop(c)}
                            disabled={loading}
                        >
                            <img
                                ref={imgRef}
                                src={imageSrc}
                                alt="Upload"
                                className="max-w-full h-auto shadow-lg rounded-md block select-none"
                                draggable={false}
                            />
                        </ReactCrop>

                        {/* Render Detected Zones (Only when not exporting) */}
                        {!isExporting && detections.map((d, i) => {
                            const style = getScaledBox(d.box);
                            if (!style) return null;
                            return (
                                <div
                                    key={i}
                                    className="absolute border-2 border-dashed border-purple-500 bg-purple-500/10 cursor-pointer hover:bg-purple-500/20 transition-colors z-0"
                                    style={{
                                        left: style.x,
                                        top: style.y,
                                        width: style.width,
                                        height: style.height
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDetectionClick(d.box);
                                    }}
                                    title="Click to translate"
                                />
                            );
                        })}

                        {translations.map((t) => (
                            <TranslationOverlay
                                key={t.id}
                                crop={t.crop}
                                text={t.text}
                                textColor={t.textColor}
                                backgroundColor={t.backgroundColor}
                                fontSize={t.fontSize}
                                isSelected={selectedId === t.id}
                                isExporting={isExporting}
                                onMouseDown={(e) => handleOverlayMouseDown(e, t.id)}
                                onClose={() => handleDeleteTranslation(t.id)}
                            />
                        ))}

                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20 backdrop-blur-[2px]">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <EditModal
                isOpen={isModalOpen}
                initialText={pendingText}
                onSave={handleApplyTranslation}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};

export default TranslatorWorkspace;
