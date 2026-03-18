// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-task-form');
    const responseDiv = document.getElementById('response');
    const submitBtn = document.getElementById('task-form-btn');

    if (!form || !responseDiv || !submitBtn) {
        console.error('One or more required elements not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous message
        responseDiv.textContent = '';
        responseDiv.className = ''; // remove success/error/info classes

        const title = document.getElementById('title')?.value.trim();
        const reminderTime = document.getElementById('reminder-time')?.value;

        if (!title) {
            showMessage('Please enter a task title', 'error');
            return;
        }
        if (!reminderTime) {
            showMessage('Please select a reminder time', 'error');
            return;
        }

        const timestamp = Math.floor(new Date(time).getTime() / 1000);

        // Prepare payload (you can easily add more fields later)
        const payload = {
            title: title,
            reminderTime: timestamp
        };

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        const serverUrl = "arn:aws:apigateway:us-east-1::/apis/349t6upj4b/routes/z4gg01l";
        
        try {
            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // If using IAM auth → you would need AWS SigV4 signing here (more complex)
                    // If using NO auth or CUSTOM auth → add Authorization header if needed
                },
                body: JSON.stringify(payload),
                // mode: 'cors',                    // usually not needed for same-origin or function URL
                // credentials: 'omit'              // default is fine
            });

            let result;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                result = { message: await response.text() };
            }

            if (response.ok) {
                showMessage(
                    result.message || 'Task reminder added successfully!',
                    'success'
                );
                form.reset(); // clear the form
            } else {
                showMessage(
                    result.error || result.message || `Error: ${response.status}`,
                    'error'
                );
                console.error('Server responded with error:', response.status, result);
            }
        } catch (err) {
            showMessage('Network error – could not reach the server', 'error');
            console.error('Fetch error:', err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    });

    function showMessage(text, type = 'info') {
        responseDiv.textContent = text;
        responseDiv.className = type; // matches .success, .error, .info from your CSS
    }
});