import React, { useRef } from 'react';

const ImageUploader = ({ onImageUpload }) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => onImageUpload(reader.result));
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current.click()}>
            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                ref={fileInputRef}
            />
            <div className="text-gray-500 font-semibold mb-2">Click to Upload Image</div>
            <div className="text-sm text-gray-400">JPG, PNG supported</div>
        </div>
    );
};

export default ImageUploader;
