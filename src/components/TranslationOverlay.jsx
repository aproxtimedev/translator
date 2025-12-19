import React from 'react';

const TranslationOverlay = ({ crop, text, textColor, backgroundColor, fontSize, isSelected, onMouseDown, onClose }) => {
    if (!crop || !text) return null;

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
            <div className="relative w-full h-full flex flex-col">
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
