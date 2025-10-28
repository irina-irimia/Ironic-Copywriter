document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileUploadInput = document.getElementById('file-upload');

    // --- ATENTIE: Inlocuieste cu datele tale ---
    const OPENAI_API_KEY ='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';
    const ASSISTANT_ID = 'asst_oNQl2GoEJlvaMbTcpog6A7IZ';

    let threadId = localStorage.getItem('openai_thread_id');
    let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];

    // Incarca istoricul conversatiei la incarcarea paginii
    function loadChatHistory() {
        chatHistory.forEach(message => {
            displayMessage(message.text, message.sender, false); // false = nu salva din nou
        });
    }

    // Creeaza un fir de conversatie nou daca nu exista
    async function getOrCreateThread() {
        if (threadId) {
            console.log("Folosind thread-ul existent:", threadId);
            return;
        }
        try {
            const response = await fetch('https://api.openai.com/v1/threads', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v1'
                }
            });
            const data = await response.json();
            threadId = data.id;
            localStorage.setItem('openai_thread_id', threadId);
            console.log("Thread nou creat:", threadId);
        } catch (error) {
            console.error("Eroare la crearea thread-ului:", error);
        }
    }

    // Afiseaza un mesaj in caseta de chat
    function displayMessage(text, className, save = true) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', className);
        messageElement.textContent = text;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (save) {
            chatHistory.push({ text: text, sender: className });
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        }
    }

    async function sendMessage() {
        const messageText = userInput.value.trim();
        if (messageText === '' || !threadId) return;

        displayMessage(messageText, 'user-message');
        userInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;

        try {
            await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v1'
                },
                body: JSON.stringify({ role: 'user', content: messageText })
            });

            const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v1'
                },
                body: JSON.stringify({ assistant_id: ASSISTANT_ID })
            });

            const runData = await runResponse.json();
            await checkRunStatus(runData.id);

        } catch (error) {
            console.error('Eroare la trimiterea mesajului:', error);
            displayMessage('Oops, ceva nu a mers bine. Probabil API-ul e prea ocupat să fie ironic.', 'assistant-message');
        } finally {
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    async function checkRunStatus(runId) {
        let isCompleted = false;
        while (!isCompleted) {
            try {
                const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v1'
                    }
                });
                const statusData = await statusResponse.json();

                if (statusData.status === 'completed') {
                    isCompleted = true;
                    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
                        headers: {
                            'Authorization': `Bearer ${OPENAI_API_KEY}`,
                            'OpenAI-Beta': 'assistants=v1'
                        }
                    });
                    const messagesData = await messagesResponse.json();
                    const assistantMessage = messagesData.data[0].content[0].text.value;
                    displayMessage(assistantMessage, 'assistant-message');
                } else if (['failed', 'cancelled', 'expired'].includes(statusData.status)) {
                    isCompleted = true;
                    console.error("Rularea a eșuat cu starea:", statusData.status);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Asteptam 1.5 secunde
                }
            } catch (error) {
                isCompleted = true;
                console.error('Eroare la verificarea stării:', error);
            }
        }
    }

    // --- Evenimente ---
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    uploadBtn.addEventListener('click', () => {
        fileUploadInput.click();
    });

    fileUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // Aici ar urma logica de upload catre un backend.
            // Pentru acest exemplu, doar afisam o notificare.
            displayMessage(`Fișier selectat: ${file.name}. Funcționalitatea de procesare necesită un backend.`, 'assistant-message');
        }
    });

    // --- Initializare ---
    loadChatHistory();
    getOrCreateThread();
});
