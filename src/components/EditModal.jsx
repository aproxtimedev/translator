import React, { useState, useEffect } from 'react';

const EditModal = ({ isOpen, initialText, onSave, onClose }) => {
    const [text, setText] = useState(initialText);

    useEffect(() => {
        setText(initialText);
    }, [initialText]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Review Translation</h2>

                <textarea
                    className="w-full h-40 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-gray-700"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Translation will appear here..."
                />

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(text)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                        Apply to Image
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditModal;
