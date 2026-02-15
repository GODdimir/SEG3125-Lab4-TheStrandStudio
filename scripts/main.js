/* scripts/main.js */

// --- 1. SELECTION ---
const stylistSelect = document.getElementById('stylistSelect');
const serviceSelect = document.getElementById('serviceSelect');
const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const bookingSummary = document.getElementById('bookingSummary');
const bookingForm = document.querySelector('form');

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

// --- 3. VALIDATION LOGIC ---
function validateBooking() {
    const dateValue = dateInput.value;
    const stylistValue = stylistSelect.value;
    const timeValue = timeInput.value;

    // A. Check Date Validity
    if (dateValue) {
        const dateObj = new Date(dateValue + 'T00:00:00'); // Force local time
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday
        
        // Determine which rules to use (Alex, Sam, or Generic)
        const rules = shopHours[stylistValue] || shopHours["any"];

        // 1. Check Off Days
        if (rules.offDays.includes(dayOfWeek)) {
            alert("Sorry, this stylist is not available on this day. Please check the schedule.");
            dateInput.value = ""; // Clear the invalid date
            return false; // Stop validation
        }

        // 2. Check Time Validity (if a time is selected)
        if (timeValue) {
            const hour = parseInt(timeValue.split(':')[0]);
            
            // Get open/close hours for this specific day
            const dailyHours = rules.hours[dayOfWeek] || rules.hours["default"];
            const open = dailyHours[0];
            const close = dailyHours[1];

            if (hour < open || hour >= close) {
                alert(`Sorry, hours on this day are ${open}:00 to ${close}:00.`);
                timeInput.value = ""; // Clear invalid time
                return false;
            }
        }
    }
    return true; // All checks passed
}

// --- 4. UPDATE SUMMARY LOGIC ---
function updateBookingSummary() {
    // Run validation first
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
    event.preventDefault(); // Stop reload

    // Final check before "submitting"
    if (serviceSelect.value === "Select a Service...") {
        alert("Please select a service.");
        return;
    }

    if (validateBooking()) {
        alert("Success! Your appointment is booked.");
        bookingForm.reset();
        bookingSummary.innerHTML = "Select a professional, service, and date to see your summary.";
        bookingSummary.classList.add('text-muted');
        bookingSummary.classList.remove('text-success');
    }
});

// --- 6. EVENT LISTENERS ---
stylistSelect.addEventListener('change', updateBookingSummary);
serviceSelect.addEventListener('change', updateBookingSummary);
dateInput.addEventListener('change', updateBookingSummary);
timeInput.addEventListener('change', updateBookingSummary);