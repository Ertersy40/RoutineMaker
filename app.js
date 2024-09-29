document.addEventListener('DOMContentLoaded', function() {
    // Variables for start and end times (24-hour format)
    const startTime = 7;  // Start at 7 AM
    const endTime = 22;   // End at 10 PM (22:00)
    const slotHeight = 50; // Height of each time slot in pixels
    const headerHeight = 50; // Height of the header row

    let currentActivityId = null;

    const scheduleContainer = document.querySelector('.schedule-container');
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Generate Time Column
    const timeColumn = document.createElement('div');
    timeColumn.classList.add('time-column');

    // Empty corner cell
    const emptyCorner = document.createElement('div');
    emptyCorner.classList.add('time-slot', 'empty');
    timeColumn.appendChild(emptyCorner);

    for (let hour = startTime; hour <= endTime; hour++) {
        const timeSlot = document.createElement('div');
        timeSlot.classList.add('time-slot');
        let displayHour = hour % 24;
        let ampm = displayHour >= 12 ? 'PM' : 'AM';
        displayHour = displayHour % 12 || 12; // Convert to 12-hour format
        timeSlot.textContent = `${displayHour} ${ampm}`;
        timeColumn.appendChild(timeSlot);
    }

    scheduleContainer.appendChild(timeColumn);

    // Generate Day Columns
    daysOfWeek.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.classList.add('day-column');
        dayColumn.setAttribute('data-day', day);

        // Day Header
        const dayHeader = document.createElement('div');
        dayHeader.classList.add('day-header');
        dayHeader.textContent = day;
        dayColumn.appendChild(dayHeader);

        // Time Slots
        for (let hour = startTime; hour <= endTime; hour++) {
            const daySlot = document.createElement('div');
            daySlot.classList.add('day-slot');
            daySlot.setAttribute('data-hour', hour);
            dayColumn.appendChild(daySlot);
        }

        scheduleContainer.appendChild(dayColumn);
    });

    // Now select the day slots after they've been created
    const daySlots = document.querySelectorAll('.day-slot');
    let isDragging = false;
    let dragStartSlot = null;
    let dragCurrentSlot = null;
    let selectedSlots = new Set(); // Use a Set for efficient add/remove operations
    let activities = JSON.parse(localStorage.getItem('activities')) || {};
    let schedule = JSON.parse(localStorage.getItem('schedule')) || {};
    const activityDialog = document.getElementById('activity-dialog');
    const notesDialog = document.getElementById('notes-dialog');
    const closeButtons = document.querySelectorAll('.close-button');
    const existingActivitiesSelect = document.getElementById('existing-activities');

    // Initialize existing activities
    function populateExistingActivities() {
        console.log("populating existing activities")
        existingActivitiesSelect.innerHTML = '<option value="">--Select--</option>';
        for (let key in activities) {
            let option = document.createElement('option');
            option.value = key;
            option.textContent = activities[key].title;
            existingActivitiesSelect.appendChild(option);
        }
    }

    populateExistingActivities();

    // Save activities and schedule to localStorage
    function saveData() {
        localStorage.setItem('activities', JSON.stringify(activities));
        localStorage.setItem('schedule', JSON.stringify(schedule));
    }

    // Update the daySlots event listeners
    daySlots.forEach(slot => {
        slot.addEventListener('mousedown', function(e) {
            if (e.ctrlKey || e.metaKey) { // Control key multi-selection
                // Toggle selection without affecting other selected slots
                if (selectedSlots.has(this)) {
                    this.classList.remove('selected');
                    selectedSlots.delete(this);
                } else {
                    this.classList.add('selected');
                    selectedSlots.add(this);
                }
            } else {
                // Start drag selection
                isDragging = true;
                dragStartSlot = this;
                dragCurrentSlot = this;
                updateSelection(); // Initialize selection
            }
        });

        slot.addEventListener('mouseover', function(e) {
            if (isDragging) {
                dragCurrentSlot = this;
                updateSelection();
            }
        });

        slot.addEventListener('mouseup', function(e) {
            if (isDragging) {
                isDragging = false;
                openActivityDialog();
            }
        });
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            openActivityDialog();
        }
    });

    function updateSelection() {
        // Clear previous selection classes
        daySlots.forEach(slot => slot.classList.remove('selected'));

        if (isDragging) {
            // Drag selection mode
            let slots = getSlotsInRange(dragStartSlot, dragCurrentSlot);
            selectedSlots = new Set(slots); // Update the selectedSlots Set
        }

        // Apply the 'selected' class to all selected slots
        selectedSlots.forEach(slot => slot.classList.add('selected'));
    }

    function getSlotsInRange(startSlot, endSlot) {
        if (startSlot.parentElement !== endSlot.parentElement) {
            // If slots are in different columns, do not select
            return [];
        }
        const slots = Array.from(startSlot.parentElement.querySelectorAll('.day-slot'));
        const startIndex = slots.indexOf(startSlot);
        const endIndex = slots.indexOf(endSlot);
        const [minIndex, maxIndex] = [startIndex, endIndex].sort((a, b) => a - b);
        return slots.slice(minIndex, maxIndex + 1);
    }

    function clearSelection() {
        selectedSlots.clear();
        daySlots.forEach(slot => slot.classList.remove('selected'));
    }

    function openActivityDialog() {
        if (selectedSlots.size === 0) return;
        activityDialog.style.display = 'block';

        // Update the dialog title with selected time(s)
        const dialogTitle = document.getElementById('activity-dialog-title');

        // Get all selected days and hours
        const selectionInfo = Array.from(selectedSlots).map(slot => {
            return {
                day: slot.parentElement.getAttribute('data-day'),
                hour: parseInt(slot.getAttribute('data-hour'))
            };
        });

        // Group by day
        const selectionByDay = {};
        selectionInfo.forEach(item => {
            if (!selectionByDay[item.day]) selectionByDay[item.day] = [];
            selectionByDay[item.day].push(item.hour);
        });

        // Build the dialog title
        let titleParts = [];
        for (let day in selectionByDay) {
            let hours = selectionByDay[day].sort((a, b) => a - b);
            let timeRanges = getTimeRanges(hours);
            timeRanges.forEach(range => {
                const startHour = formatHour(range.start);
                const endHour = formatHour(range.end + 1); // End hour is exclusive
                const timeRange = range.start !== range.end ? `${startHour} - ${endHour}` : `${startHour}`;
                titleParts.push(`${day} ${timeRange}`);
            });
        }
        dialogTitle.textContent = `Add Activity for ${titleParts.join(', ')}`;
    }

    // Helper function to get consecutive time ranges
    function getTimeRanges(hours) {
        let ranges = [];
        if (hours.length === 0) return ranges;
        let rangeStart = hours[0];
        let previousHour = hours[0];

        for (let i = 1; i <= hours.length; i++) {
            let currentHour = hours[i];
            if (currentHour - previousHour === 1) {
                previousHour = currentHour;
            } else {
                ranges.push({ start: rangeStart, end: previousHour });
                rangeStart = currentHour;
                previousHour = currentHour;
            }
        }
        return ranges;
    }

    // Helper function to format hour
    function formatHour(hour24) {
        if (hour24 >= 24) hour24 -= 24; // Adjust for 24-hour wrap-around
        let period = hour24 >= 12 ? 'PM' : 'AM';
        let hour12 = hour24 % 12 || 12;
        return `${hour12} ${period}`;
    }

    // Update close button event handlers
    function closeActivityDialog() {
        activityDialog.style.display = 'none';
        clearSelection();
    }

    // Function to close the notes dialog
    function closeNotesDialog() {
        // Remove completed todo items before closing
        removeCompletedTodos(currentActivityId);
        notesDialog.style.display = 'none';
        currentActivityId = null; // Reset the current activity ID
    }

    // Update close button event handlers
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Check which modal is being closed
            if (this.parentElement.parentElement.id === 'activity-dialog') {
                closeActivityDialog();
            } else if (this.parentElement.parentElement.id === 'notes-dialog') {
                closeNotesDialog();
            }
        });
    });

    // Add event listeners to modals to close when clicking outside the modal content
    activityDialog.addEventListener('click', function(event) {
        if (event.target === activityDialog) {
            closeActivityDialog();
        }
    });

    notesDialog.addEventListener('click', function(event) {
        if (event.target === notesDialog) {
            closeNotesDialog();
        }
    });

    // Function to remove completed todos
    function removeCompletedTodos(activityId) {
        if (activityId && activities[activityId]) {
            // Filter out completed notes
            activities[activityId].notes = activities[activityId].notes.filter(note => !note.completed);
            saveData();
        }
    }

    // Update form fields when existing activity is selected
    existingActivitiesSelect.addEventListener('change', function() {
        const selectedActivityId = this.value;
        const titleField = document.getElementById('activity-title');
        const descField = document.getElementById('activity-desc');
        const colorField = document.getElementById('activity-color');

        if (selectedActivityId) {
            // Existing activity selected
            const activity = activities[selectedActivityId];
            titleField.value = activity.title;
            descField.value = activity.description;
            colorField.value = activity.color;

            // Disable fields
            titleField.disabled = true;
            descField.disabled = true;
            colorField.disabled = true;
        } else {
            // No activity selected
            titleField.value = '';
            descField.value = '';
            colorField.value = '#000000';

            // Enable fields
            titleField.disabled = false;
            descField.disabled = false;
            colorField.disabled = false;
        }
    });

    // Handle activity form submission
    document.getElementById('activity-form').addEventListener('submit', function(e) {
        e.preventDefault();
        let existingActivityId = existingActivitiesSelect.value;
        let activityId = existingActivityId || Date.now().toString();

        if (existingActivityId) {
            // Use existing activity
        } else {
            // Create new activity
            let title = document.getElementById('activity-title').value;
            let description = document.getElementById('activity-desc').value;
            let color = document.getElementById('activity-color').value || getRandomColor();

            activities[activityId] = { title, description, color, notes: [] };
            populateExistingActivities();
        }

        selectedSlots.forEach(slot => {
            let day = slot.parentElement.getAttribute('data-day');
            let hour = slot.getAttribute('data-hour');
            if (!schedule[day]) schedule[day] = {};
            schedule[day][hour] = activityId;
        });

        saveData();
        activityDialog.style.display = 'none';
        clearSelection();
        this.reset();

        // Reset form fields
        const titleField = document.getElementById('activity-title');
        const descField = document.getElementById('activity-desc');
        const colorField = document.getElementById('activity-color');
        titleField.disabled = false;
        descField.disabled = false;
        colorField.disabled = false;

        // Reload the schedule to reflect merged activities
        loadSchedule();
    });

    function openNotesDialog(activityId) {
        notesDialog.style.display = 'block';
        currentActivityId = activityId; // Store the current activity ID

        const activity = activities[activityId];

        // Close the settings section by default when opening the dialog
        activitySettingsSection.classList.remove('open');
        settingsToggleButton.innerHTML = 'Settings &#9660;'; // Reset to default state
        // Update the dialog title and description
        const notesDialogTitle = document.getElementById('notes-dialog-title');
        const notesDialogDescription = document.getElementById('notes-dialog-description');
        notesDialogTitle.textContent = activity.title;
        notesDialogDescription.textContent = activity.description || '';

        // Make the title and description editable on click
        makeTextEditable(notesDialogTitle, 'title');
        makeTextEditable(notesDialogDescription, 'description');

        // Populate the settings form with the activity details
        document.getElementById('activity-color-settings').value = activity.color;
        populateActivityScheduleSettings(activityId);
        
        let todoList = document.getElementById('todo-list');
        todoList.innerHTML = '';
        activities[activityId].notes.forEach((note, index) => {
            let li = document.createElement('li');
            li.className = 'todo-item';

            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = note.completed;
            checkbox.addEventListener('change', function() {
                note.completed = this.checked;
                saveData();
                if (note.completed) {
                    textSpan.classList.add('completed');
                } else {
                    textSpan.classList.remove('completed');
                }
            });

            let textSpan = document.createElement('span');
            textSpan.textContent = note.text;
            if (note.completed) textSpan.classList.add('completed');

            li.appendChild(checkbox);
            li.appendChild(textSpan);
            todoList.appendChild(li);
        });

        // Handle adding new todo
        document.getElementById('add-todo-button').onclick = function() {
            let newTodoText = document.getElementById('new-todo').value;
            if (newTodoText) {
                activities[activityId].notes.push({ text: newTodoText, completed: false });
                saveData();
                document.getElementById('new-todo').value = '';
                openNotesDialog(activityId); // Refresh the dialog
            }
        };
    }

    // Reference to the settings toggle button and settings section
    const settingsToggleButton = document.getElementById('settings-toggle-button');
    const activitySettingsSection = document.getElementById('activity-settings');

    // Add event listener to the settings toggle button
    settingsToggleButton.addEventListener('click', function() {
        if (activitySettingsSection.classList.contains('open')) {
            // Collapse the settings section
            activitySettingsSection.classList.remove('open');
            settingsToggleButton.innerHTML = 'Settings &#9660;'; // Down arrow
        } else {
            // Expand the settings section
            activitySettingsSection.classList.add('open');
            settingsToggleButton.innerHTML = 'Settings &#9650;'; // Up arrow
        }
    });

    function makeTextEditable(element, field) {
        element.addEventListener('click', function() {
            // If already in editing mode, do nothing
            if (element.isContentEditable) return;

            element.contentEditable = true;
            element.focus();

            // Select all text
            document.execCommand('selectAll', false, null);

            // Handle when editing is finished
            element.addEventListener('blur', function() {
                element.contentEditable = false;
                // Save the updated value
                activities[currentActivityId][field] = element.textContent.trim();
                saveData();
                // Update other UI elements if necessary
                if (field === 'title') {
                    // Update the activity blocks with the new title
                    loadSchedule();
                }
            }, { once: true });
        });
    }

    function populateActivityScheduleSettings(activityId) {
        // Find the first occurrence of the activity in the schedule
        let found = false;
        for (let day in schedule) {
            for (let hour in schedule[day]) {
                if (schedule[day][hour] === activityId) {
                    document.getElementById('activity-day').value = day;
                    // Convert hour to time format (e.g., "14:00")
                    let startTime = `${String(hour).padStart(2, '0')}:00`;
                    document.getElementById('activity-start-time').value = startTime;
                    // Find the end time by checking consecutive hours
                    let endHour = parseInt(hour);
                    while (schedule[day][endHour + 1] === activityId) {
                        endHour++;
                    }
                    let endTime = `${String(endHour + 1).padStart(2, '0')}:00`;
                    document.getElementById('activity-end-time').value = endTime;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }
    

    // Load existing schedule
    function loadSchedule() {
        // Clear existing activity blocks
        const activityBlocks = document.querySelectorAll('.activity-block');
        activityBlocks.forEach(block => block.remove());

        for (let day in schedule) {
            let daySchedule = schedule[day];
            let dayColumn = document.querySelector(`.day-column[data-day="${day}"]`);

            let activitySpans = {};
            for (let hour in daySchedule) {
                let activityId = daySchedule[hour];
                if (!activitySpans[activityId]) {
                    activitySpans[activityId] = [];
                }
                activitySpans[activityId].push(parseInt(hour));
            }

            for (let activityId in activitySpans) {
                let hours = activitySpans[activityId].sort((a, b) => a - b);

                // Group consecutive hours
                let ranges = getTimeRanges(hours);

                // For each range, create an activity block
                ranges.forEach(range => {
                    let startHour = range.start;
                    let endHour = range.end;

                    let startHourIndex = startHour - startTime;
                    let totalSlots = endHour - startHour + 1;
                    if (activities[activityId]) {

                        let activityBlock = document.createElement('div');
                        let rgb = hexToRgb(activities[activityId].color)
                        activityBlock.className = 'activity-block';
                        activityBlock.style.border = `5px solid ${activities[activityId].color}`
                        activityBlock.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`;
                        activityBlock.textContent = activities[activityId].title;
                        
                        // Position the activity block absolutely
                        activityBlock.style.position = 'absolute';
                        activityBlock.style.left = '0';
                        activityBlock.style.width = '100%';
                        activityBlock.style.zIndex = '1';
                        activityBlock.style.top = `${headerHeight + (startHourIndex * slotHeight)}px`;
                        activityBlock.style.height = `${totalSlots * slotHeight}px`;
                        
                        activityBlock.addEventListener('click', function(e) {
                            e.stopPropagation();
                            openNotesDialog(activityId);
                        });
                        dayColumn.appendChild(activityBlock);
                    } else {
                        console.log("Adding activity failed!")
                        console.log(activities, activityId, activities[activityId])
                    }
                });
            }
        }
    }
    loadSchedule();

    // Highlight current day/time
    function highlightCurrentTime() {
        let now = new Date();
        let hours = now.getHours();
        let dayIndex = now.getDay(); // Sunday is 0
        let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let currentDay = days[dayIndex];
        let slot = document.querySelector(`.day-column[data-day="${currentDay}"] .day-slot[data-hour="${hours}"]`);
        if (slot) {
            slot.classList.add('current-time-outline');
        }
    }
    highlightCurrentTime();

    // Random bright color generator
    function getRandomColor() {
        let letters = '89ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * letters.length)];
        }
        return color;
    }

    document.getElementById('activity-settings-form').addEventListener('submit', function(e) {
        e.preventDefault();

        // Get updated values from the form
        // Name and description fields are removed
        let newColor = document.getElementById('activity-color-settings').value;
        let newDay = document.getElementById('activity-day').value;
        let newStartTime = document.getElementById('activity-start-time').value;
        let newEndTime = document.getElementById('activity-end-time').value;

        // Update the activity details
        let activity = activities[currentActivityId];
        activity.color = newColor;

        // Remove the activity from its current schedule
        removeActivityFromSchedule(currentActivityId);

        // Add the activity to the new schedule
        addActivityToSchedule(currentActivityId, newDay, newStartTime, newEndTime);

        // Save changes
        saveData();

        // Reload the schedule display
        loadSchedule();

        // Close the dialog
        notesDialog.style.display = 'none';
        currentActivityId = null;
    });
    
    function removeActivityFromSchedule(activityId) {
        for (let day in schedule) {
            for (let hour in schedule[day]) {
                if (schedule[day][hour] === activityId) {
                    delete schedule[day][hour];
                }
            }
        }
    }
    
    function addActivityToSchedule(activityId, day, startTime, endTime) {
        if (!schedule[day]) schedule[day] = {};
    
        let startHour = parseInt(startTime.split(':')[0]);
        let endHour = parseInt(endTime.split(':')[0]);
    
        // Adjust for 24-hour wrap-around if necessary
        if (endHour <= startHour) {
            endHour += 24;
        }
    
        for (let hour = startHour; hour < endHour; hour++) {
            let actualHour = hour % 24; // Adjust back to 0-23
            schedule[day][actualHour] = activityId;
        }
    }
    
    
    document.getElementById('delete-activity-button').addEventListener('click', function() {
        // Confirm deletion
        if (confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
            // Remove the activity from the activities list
            delete activities[currentActivityId];
    
            // Remove the activity from the schedule
            removeActivityFromSchedule(currentActivityId);
    
            // Save changes
            saveData();
    
            // Reload the schedule display
            loadSchedule();
    
            // Close the dialog
            notesDialog.style.display = 'none';
            currentActivityId = null;
        }
    });
});


function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }


