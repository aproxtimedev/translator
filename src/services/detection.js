
export const detectSpeechBalloons = async (imageBlob) => {
    const API_URL = import.meta.env.VITE_DETECTION_API_URL || 'https://aproxtimedev-comic-speech-ballon.hf.space/detect';

    const formData = new FormData();
    formData.append('file', imageBlob);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Detection API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.detections || [];
    } catch (error) {
        console.error("Error detecting balloons:", error);
        throw error;
    }
};
