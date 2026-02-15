/* scripts/main.js */

// 1. Select all the elements we need to interact with
const stylistSelect = document.getElementById('stylistSelect');
const serviceSelect = document.getElementById('serviceSelect');
const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const bookingSummary = document.getElementById('bookingSummary');

// 2. Define the function that updates the text
function updateBookingSummary() {
    // Get the text (not value) of the selected options
    const stylist = stylistSelect.options[stylistSelect.selectedIndex].text;
    const service = serviceSelect.options[serviceSelect.selectedIndex].text;
    
    // Get the values of the inputs
    const date = dateInput.value;
    const time = timeInput.value;

    // Check if the user has made valid selections
    // (We check if they are NOT the default "Open this menu" options)
    const isStylistSelected = stylist !== "Any Professional";
    const isServiceSelected = service !== "Select a Service...";
    const isDateSelected = date !== "";
    const isTimeSelected = time !== "";

    // 3. Update the HTML based on what is selected
    if (isStylistSelected && isServiceSelected && isDateSelected && isTimeSelected) {
        // If everything is filled out, show the specific confirmation
        bookingSummary.innerHTML = `You are booking <strong>${service}</strong> with <strong>${stylist}</strong> on <strong>${date}</strong> at <strong>${time}</strong>.`;
        bookingSummary.classList.remove('text-muted');
        bookingSummary.classList.add('text-success');
    } else {
        // If not complete, give a gentle prompt
        bookingSummary.innerHTML = "Please fill out all details above to see your booking summary.";
        bookingSummary.classList.add('text-muted');
        bookingSummary.classList.remove('text-success');
    }
}

// 4. Attach the function to the 'change' event of every input
stylistSelect.addEventListener('change', updateBookingSummary);
serviceSelect.addEventListener('change', updateBookingSummary);
dateInput.addEventListener('change', updateBookingSummary);
timeInput.addEventListener('change', updateBookingSummary);