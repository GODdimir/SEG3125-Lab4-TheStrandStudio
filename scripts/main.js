/* scripts/main.js */

// --- 1. SELECTION ---
const stylistSelect = document.getElementById('stylistSelect');
const serviceSelect = document.getElementById('serviceSelect');
const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const bookingSummary = document.getElementById('bookingSummary');
const bookingForm = document.getElementById('appointmentForm');

// --- 2. SCHEDULE CONFIGURATION ---
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const shopHours = {
    "alex": {
        offDays: [0, 3], // Sunday (0) and Wednesday (3)
        hours: {
            "default": [10, 20], // 10am - 8pm
            6: [9, 17]           // Saturday: 9am - 5pm
        }
    },
    "sam": {
        offDays: [0, 1], // Sunday (0) and Monday (1)
        hours: {
            "default": [10, 20], // 10am - 8pm
            6: [9, 17]           // Saturday: 9am - 5pm
        }
    },
    "any": { // If no specific professional selected
        offDays: [0], // Only Sunday
        hours: {
            "default": [10, 20],
            6: [9, 17]
        }
    }
};

// --- 3. LAB 5 REGULAR EXPRESSIONS & VALIDATION ---
const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/; // Letters, spaces, hyphens
const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/; // Various 10-digit formats
const ccRegex = /^(?:\d[ -]*?){13,16}$/; // 13-16 digits with optional spaces/dashes

function validateTextFields() {
    let isValid = true;
    
    const nameInput = document.getElementById('nameInput');
    const phoneInput = document.getElementById('phoneInput');
    const ccInput = document.getElementById('ccInput');

    // Name Validation
    if (nameInput.value && !nameRegex.test(nameInput.value)) {
        nameInput.classList.add('is-invalid');
        isValid = false;
    } else if (nameInput.value) {
        nameInput.classList.remove('is-invalid');
        nameInput.classList.add('is-valid');
    } else {
        nameInput.classList.add('is-invalid');
        isValid = false;
    }

    // Phone Validation
    if (phoneInput.value && !phoneRegex.test(phoneInput.value)) {
        phoneInput.classList.add('is-invalid');
        isValid = false;
    } else if (phoneInput.value) {
        phoneInput.classList.remove('is-invalid');
        phoneInput.classList.add('is-valid');
    } else {
        phoneInput.classList.add('is-invalid');
        isValid = false;
    }

    // CC Validation
    if (ccInput.value && !ccRegex.test(ccInput.value)) {
        ccInput.classList.add('is-invalid');
        isValid = false;
    } else if (ccInput.value) {
        ccInput.classList.remove('is-invalid');
        ccInput.classList.add('is-valid');
    } else {
        ccInput.classList.add('is-invalid');
        isValid = false;
    }

    return isValid;
}

// Check schedule logic with inline feedback
function validateBooking() {
    const dateValue = dateInput.value;
    const stylistValue = stylistSelect.value;
    const timeValue = timeInput.value;

    if (dateValue) {
        // Adjust for local timezone accurately
        const dateParts = dateValue.split('-');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); 
        const dayOfWeek = dateObj.getDay(); 
        
        const rules = shopHours[stylistValue] || shopHours["any"];

        // 1. Check Off Days
        if (rules.offDays.includes(dayOfWeek)) {
            dateInput.classList.add('is-invalid');
            dateInput.value = ""; 
            return false; 
        } else {
            dateInput.classList.remove('is-invalid');
        }

        // 2. Check Time Validity
        if (timeValue) {
            const hour = parseInt(timeValue.split(':')[0]);
            const dailyHours = rules.hours[dayOfWeek] || rules.hours["default"];
            const open = dailyHours[0];
            const close = dailyHours[1];

            if (hour < open || hour >= close) {
                timeInput.classList.add('is-invalid');
                timeInput.value = ""; 
                return false;
            } else {
                timeInput.classList.remove('is-invalid');
            }
        }
    }
    return true; 
}

// --- 4. UPDATE SUMMARY LOGIC ---
function updateBookingSummary() {
    if (!validateBooking()) return;

    const stylist = stylistSelect.options[stylistSelect.selectedIndex].text;
    const service = serviceSelect.options[serviceSelect.selectedIndex].text;
    const date = dateInput.value;
    const time = timeInput.value;

    const isStylistSelected = stylist !== "Any Professional";
    const isServiceSelected = service !== "Select a Service...";
    const isDateSelected = date !== "";
    const isTimeSelected = time !== "";

    if (isStylistSelected && isServiceSelected && isDateSelected && isTimeSelected) {
        bookingSummary.innerHTML = `You are booking <strong>${service}</strong> with <strong>${stylist}</strong> on <strong>${date}</strong> at <strong>${time}</strong>.`;
        bookingSummary.classList.remove('text-muted');
        bookingSummary.classList.add('text-success');
    } else {
        bookingSummary.innerHTML = "Select a professional, service, and date to see your summary.";
        bookingSummary.classList.add('text-muted');
        bookingSummary.classList.remove('text-success');
    }
}

// --- 5. HANDLE FORM SUBMISSION ---
bookingForm.addEventListener('submit', function(event) {
    event.preventDefault(); 
    
    // Run all validations
    const isScheduleValid = validateBooking();
    const isTextValid = validateTextFields();

    if (serviceSelect.value === "Select a Service...") {
        serviceSelect.classList.add('is-invalid');
        return;
    } else {
        serviceSelect.classList.remove('is-invalid');
        serviceSelect.classList.add('is-valid');
    }
    
    if (!dateInput.value) {
        dateInput.classList.add('is-invalid');
        return;
    }

    if (isScheduleValid && isTextValid && dateInput.value !== "") {
        alert("Success! Your appointment and payment have been securely processed.");
        bookingForm.reset();
        
        // Remove validation styling
        const inputs = bookingForm.querySelectorAll('.form-control, .form-select');
        inputs.forEach(input => {
            input.classList.remove('is-valid', 'is-invalid');
        });

        bookingSummary.innerHTML = "Select a professional, service, and date to see your summary.";
        bookingSummary.classList.add('text-muted');
        bookingSummary.classList.remove('text-success');
    }
});

// --- 6. EVENT LISTENERS & INITIALIZATION ---
stylistSelect.addEventListener('change', updateBookingSummary);
serviceSelect.addEventListener('change', updateBookingSummary);
dateInput.addEventListener('change', updateBookingSummary);
timeInput.addEventListener('change', updateBookingSummary);

// Lab 5: Initialize Bootstrap Tooltips
document.addEventListener("DOMContentLoaded", function(){
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl)
    })
});