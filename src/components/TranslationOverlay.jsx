import React from 'react';

const TranslationOverlay = ({ crop, text, textColor, backgroundColor, fontSize, isSelected, isExporting, onMouseDown, onClose }) => {
    if (!crop || !text) return null;

    // Simplified rendering for export to avoid html2canvas layout bugs
    if (isExporting) {
        return (
            <div
                className="absolute flex items-center justify-center p-2 font-medium backdrop-blur-sm rounded overflow-visible z-10"
                style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.width,
                    height: crop.height,
                    color: textColor || '#ffffff',
                    backgroundColor: backgroundColor || 'rgba(0, 0, 0, 0.75)',
                    fontSize: `${fontSize || 14}px`,
                    lineHeight: '1.4', // Slightly looser line height for safety
                    whiteSpace: 'pre-wrap', // Preserve spaces
                    wordWrap: 'break-word',
                }}
            >
                <div className="text-center w-full">
                    {text}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`absolute flex items-center justify-center p-2 font-medium backdrop-blur-sm rounded overflow-y-auto ${isSelected ? 'ring-2 ring-yellow-400 z-50' : 'z-10'}`}
            onMouseDown={onMouseDown}
            style={{
                left: crop.x,
                top: crop.y,
                width: crop.width,
                height: crop.height,
                color: textColor || '#ffffff',
                backgroundColor: backgroundColor || 'rgba(0, 0, 0, 0.75)',
                fontSize: `${fontSize || 14}px`,
                lineHeight: '1.2',
                cursor: 'move',
            }}
        >
            <div className="relative w-full h-full flex flex-col justify-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute top-0 right-0 p-1 text-xs text-gray-300 hover:text-white"
                    title="Close"
                >
                    ✕
                </button>
                <div className="mt-4 text-center break-words">
                    {text}
                </div>
            </div>
        </div>
    );
};

export default TranslationOverlay;
