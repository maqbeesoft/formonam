// Configuration - Replace with your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiH5dXqtumXVrpB_1szEnG1zJsZd3Irifr75Mz_axnqEsPbjyZnolnGO0YVdooot7o/exec';

// Use localStorage to persist submitted phone numbers
function getSubmittedPhones() {
  try {
    return JSON.parse(localStorage.getItem('submittedPhones')) || [];
  } catch {
    return [];
  }
}

function addSubmittedPhone(phone) {
  const phones = getSubmittedPhones();
  phones.push(phone);
  localStorage.setItem('submittedPhones', JSON.stringify(phones));
}

// Show popup function
function showPopup(message) {
  // Remove existing popup if any
  const oldPopup = document.querySelector('.popup');
  if (oldPopup) oldPopup.remove();

  // Create popup elements
  const popup = document.createElement('div');
  popup.className = 'popup';
  const box = document.createElement('div');
  box.className = 'popup-box';
  box.innerHTML = `
    <h2>Success!</h2>
    <p>${message}</p>
    <button onclick="document.querySelector('.popup').remove()">Close</button>
  `;
  popup.appendChild(box);
  document.body.appendChild(popup);
}

// Function to send data to Google Sheets using JSONP (avoids CORS issues)
function sendToGoogleSheets(data) {
  return new Promise((resolve, reject) => {
    // Create a unique callback name
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    
    // Create the script element
    const script = document.createElement('script');
    const params = new URLSearchParams({
      callback: callbackName,
      data: JSON.stringify(data)
    });
    script.src = GOOGLE_SCRIPT_URL + '?' + params.toString();
    
    // Set up the callback function
    window[callbackName] = function(response) {
      // Clean up
      document.head.removeChild(script);
      delete window[callbackName];
      
      if (response.success) {
        resolve({ success: true, message: response.message });
      } else {
        reject(new Error(response.message || 'Failed to submit to Google Sheets'));
      }
    };
    
    // Handle script loading errors
    script.onerror = function() {
      document.head.removeChild(script);
      delete window[callbackName];
      reject(new Error('Failed to load Google Apps Script'));
    };
    
    // Add script to head to execute
    document.head.appendChild(script);
    
    // Set a timeout in case the request hangs
    setTimeout(() => {
      if (window[callbackName]) {
        document.head.removeChild(script);
        delete window[callbackName];
        reject(new Error('Request timeout'));
      }
    }, 10000); // 10 second timeout
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = {};
  
  for (let [key, value] of formData.entries()) {
    if (key === 'picture' && value.name) {
      data[key] = value.name;
    } else if (value.trim && value.trim()) {
      data[key] = value;
    }
  }

  // Check if phone number already submitted (using localStorage)
  const phone = data.phone ? data.phone.trim() : "";
  const submittedPhones = getSubmittedPhones();
  if (phone && submittedPhones.includes(phone)) {
    // Show error message
    showPopup("<span style='color:red;'><strong>You have already submitted the form.</strong></span>");
    return;
  }

  // Show loading message
  showPopup("<span style='color:blue;'><strong>Submitting...</strong></span>");

  // Send data to Google Sheets
  try {
    const result = await sendToGoogleSheets(data);

    // Add phone to submitted list in localStorage only if Google Sheets submission was successful
    if (phone) {
      addSubmittedPhone(phone);
    }

    // Display form data in popup
    let html = '';
    if (data.name) html += `<p><strong>Name:</strong> ${data.name}</p>`;
    if (data.place) html += `<p><strong>Place:</strong> ${data.place}</p>`;
    if (data.age) html += `<p><strong>Age:</strong> ${data.age}</p>`;
    if (data.phone) html += `<p><strong>Phone Number:</strong> ${data.phone}</p>`;
    if (data.email) html += `<p><strong>Email (optional):</strong> ${data.email}</p>`;
    if (data.picture) html += `<p><img src="${data.picture}" alt="Uploaded Picture"></p>`;

    showPopup(`<strong>Form Submitted Successfully!</strong><br>${html}<br><em>Data saved to Google Sheets</em>`);
  } catch (error) {
    // Show error message
    showPopup(`<span style='color:red;'><strong>Submission Failed:</strong><br>${error.message}</span>`);
  }
}