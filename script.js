const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw197GWWWMv_4oYicwaTdBgSiNZ7mNdvuFozoCzlCZb8rHgpafYSBcS6kWQ632MR7Y/exec';

    function getSubmittedPhones() {
      try {
        return JSON.parse(localStorage.getItem('submittedPhones')) || [];
      } catch {
        return [];
      }
    }

    function addSubmittedPhone(phone) {
      const phones = getSubmittedPhones();
      if (!phones.includes(phone)) {
        phones.push(phone);
        localStorage.setItem('submittedPhones', JSON.stringify(phones));
      }
    }

    function showPopup(message) {
      const oldPopup = document.querySelector('.popup');
      if (oldPopup) oldPopup.remove();

      const popup = document.createElement('div');
      popup.className = 'popup';
      const box = document.createElement('div');
      box.className = 'popup-box';
      box.innerHTML = `
        <h2>Notice</h2>
        <div>${message}</div>
        <button onclick="document.querySelector('.popup')?.remove()">Close</button>
      `;
      popup.appendChild(box);
      document.body.appendChild(popup);
    }

    function sendToGoogleSheets(data) {
      return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.floor(Math.random() * 100000);
        const params = new URLSearchParams({
          callback: callbackName,
          data: JSON.stringify(data)
        });

        const script = document.createElement('script');
        script.src = `${GOOGLE_SCRIPT_URL}?${params.toString()}`;

        window[callbackName] = function (response) {
          delete window[callbackName];
          document.head.removeChild(script);
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || 'Failed to submit data.'));
          }
        };

        script.onerror = function () {
          delete window[callbackName];
          document.head.removeChild(script);
          reject(new Error('Failed to load Google Apps Script.'));
        };

        document.head.appendChild(script);

        setTimeout(() => {
          if (window[callbackName]) {
            delete window[callbackName];
            document.head.removeChild(script);
            reject(new Error('Request timed out.'));
          }
        }, 10000);
      });
    }

    async function handleSubmit(event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = {};

      for (const [key, value] of formData.entries()) {
        if (key === 'picture' && value.name) {
          data[key] = value.name;
        } else if (value.trim && value.trim()) {
          data[key] = value.trim();
        }
      }

      const phone = data.phone || '';
      if (phone && getSubmittedPhones().includes(phone)) {
        showPopup("<span style='color:red;'><strong>You have already submitted the form.</strong></span>");
        return;
      }

      showPopup("<span style='color:blue;'><strong>Submitting your data...</strong></span>");

      try {
        const result = await sendToGoogleSheets(data);

        if (phone) addSubmittedPhone(phone);

        const details = [
          data.name && `<p><strong>Name:</strong> ${data.name}</p>`,
          data.place && `<p><strong>Place:</strong> ${data.place}</p>`,
          data.age && `<p><strong>Age:</strong> ${data.age}</p>`,
          data.phone && `<p><strong>Phone:</strong> ${data.phone}</p>`,
          data.email && `<p><strong>Email:</strong> ${data.email}</p>`,
          data.picture && `<p><img src="${data.picture}" alt="Uploaded Picture" style="max-width:200px;"></p>`
        ].filter(Boolean).join('');

        showPopup(`<strong>Form Submitted Successfully!</strong>${details}<em>Data saved to Google Sheets.</em>`);
      } catch (error) {
        showPopup(`<span style='color:red;'><strong>Submission Failed:</strong><br>${error.message}</span>`);
      }
    }

    document.getElementById('dataForm').addEventListener('submit', handleSubmit);