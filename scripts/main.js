/* scripts/main.js */

// --- 1. SELECTION ---
const stylistSelect = document.getElementById('stylistSelect');
const serviceSelect = document.getElementById('serviceSelect');
const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const bookingSummary = document.getElementById('bookingSummary');
// Select the form itself so we can listen for the submit event
const bookingForm = document.querySelector('form');

// --- 2. UPDATE SUMMARY LOGIC ---
function updateBookingSummary() {
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
        bookingSummary.innerHTML = "Please fill out all details above to see your booking summary.";
        bookingSummary.classList.add('text-muted');
        bookingSummary.classList.remove('text-success');
    }
}

// --- 3. HANDLE FORM SUBMISSION (Prevent Page Reload) ---
bookingForm.addEventListener('submit', function(event) {
    // A. Stop the form from reloading the page
    event.preventDefault();

    // B. Basic Validation (Optional: Check if fields are empty)
    const service = serviceSelect.value;
    
    // C. Show success message (You can replace this with a Bootstrap modal if you want)
    if (service !== "Select a Service...") {
        alert("Success! Your appointment has been booked. We sent a confirmation to your email.");
        // Optional: Reset the form
        bookingForm.reset();
        updateBookingSummary(); // Reset the summary text too
    } else {
        alert("Please select a service before booking.");
    }
});

// --- 4. EVENT LISTENERS ---
stylistSelect.addEventListener('change', updateBookingSummary);
serviceSelect.addEventListener('change', updateBookingSummary);
dateInput.addEventListener('change', updateBookingSummary);
timeInput.addEventListener('change', updateBookingSummary);