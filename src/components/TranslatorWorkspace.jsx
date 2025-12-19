import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getCroppedImg } from '../utils/canvasUtils';
import { translateImageText } from '../services/gemini';
import TranslationOverlay from './TranslationOverlay';
import EditModal from './EditModal';
import html2canvas from 'html2canvas';

const TranslatorWorkspace = () => {
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState();
    const [translations, setTranslations] = useState([]); // Array of { id, crop, text, textColor, backgroundColor, fontSize }
    const [loading, setLoading] = useState(false);

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
        setIsModalOpen(false);
        setSelectedId(null);
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
            <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Manual Web Image Translator</h1>

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
                                onClick={async () => {
                                    if (!containerRef.current) return;
                                    setLoading(true); // Show loading during export

                                    // Temporarily deselect any active overlay to remove selection border
                                    const currentSelection = selectedId;
                                    setSelectedId(null);

                                    // Small delay to allow React to re-render without selection border
                                    await new Promise(resolve => setTimeout(resolve, 100));

                                    try {
                                        const canvas = await html2canvas(containerRef.current, {
                                            useCORS: true, // Handle cross-origin images if necessary
                                            scale: 2, // Higher quality
                                            backgroundColor: null, // Transparent background if any
                                        });

                                        const link = document.createElement('a');
                                        link.download = `translated-image-${Date.now()}.png`;
                                        link.href = canvas.toDataURL('image/png');
                                        link.click();
                                    } catch (error) {
                                        console.error("Export failed:", error);
                                        alert("Failed to export image.");
                                    } finally {
                                        // Restore selection
                                        setSelectedId(currentSelection);
                                        setLoading(false);
                                    }
                                }}
                                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition shadow-sm flex items-center gap-2"
                            >
                                Export Image
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

                        {translations.map((t) => (
                            <TranslationOverlay
                                key={t.id}
                                crop={t.crop}
                                text={t.text}
                                textColor={t.textColor}
                                backgroundColor={t.backgroundColor}
                                fontSize={t.fontSize}
                                isSelected={selectedId === t.id}
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
