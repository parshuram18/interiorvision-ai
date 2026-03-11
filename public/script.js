document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const imageUpload = document.getElementById('imageUpload');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imagePreview = document.getElementById('imagePreview');
    const form = document.getElementById('designForm');

    const resultSection = document.getElementById('resultSection');
    const resultOriginalImage = document.getElementById('resultOriginalImage');
    const resultGeneratedImage = document.getElementById('resultGeneratedImage');
    const imageLoader = document.getElementById('imageLoader');
    const aiTipsContainer = document.getElementById('aiTipsContainer');

    const generateBtn = document.getElementById('generateBtn');
    const btnText = generateBtn.querySelector('.btn-text');
    const btnLoader = generateBtn.querySelector('.btn-loader');

    // Handle drag and drop
    uploadArea.addEventListener('click', () => imageUpload.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            imageUpload.files = e.dataTransfer.files;
            handleImagePreview(e.dataTransfer.files[0]);
        }
    });

    // Handle file picker
    imageUpload.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleImagePreview(e.target.files[0]);
        }
    });

    function handleImagePreview(file) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
                uploadPlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!imageUpload.files.length) {
            alert('Please upload a room image first.');
            return;
        }

        const formData = new FormData();
        formData.append('image', imageUpload.files[0]);
        formData.append('style', document.getElementById('styleSelect').value);
        formData.append('prompt', document.getElementById('promptInput').value);

        // Update UI state to loading
        generateBtn.disabled = true;
        btnText.textContent = 'Generating...';
        btnLoader.classList.remove('hidden');
        btnLoader.classList.add('spinner');

        // Show results section with skeleton loaders
        resultSection.classList.remove('hidden');
        resultOriginalImage.src = imagePreview.src;
        resultGeneratedImage.classList.add('hidden');
        imageLoader.classList.remove('hidden');

        aiTipsContainer.innerHTML = `
            <div class="skeleton-loader">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
            </div>`;

        // Scroll to results
        resultSection.scrollIntoView({ behavior: 'smooth' });

        try {
            const response = await fetch('/api/generate-design', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to generate design');

            // Display results
            imageLoader.classList.add('hidden');
            resultGeneratedImage.src = data.generatedImage;
            resultGeneratedImage.classList.remove('hidden');

            aiTipsContainer.innerHTML = data.tips;

        } catch (error) {
            console.error('Error:', error);
            imageLoader.innerHTML = `<p style="color: #ef4444">Error: ${error.message}</p>`;
            aiTipsContainer.innerHTML = `<p style="color: #ef4444">Could not load AI tips.</p>`;
        } finally {
            // Restore button state
            generateBtn.disabled = false;
            btnText.textContent = 'Generate Design';
            btnLoader.classList.add('hidden');
            btnLoader.classList.remove('spinner');
        }
    });
});
