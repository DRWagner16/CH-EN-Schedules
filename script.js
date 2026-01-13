// In script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global variables ---
    let allCourses = [];
    let siteConfig = {};
    const courseColorMap = new Map();
    const dayMap = { 'M': 'Mo', 'T': 'Tu', 'W': 'We', 'R': 'Th', 'F': 'Fr' };
    const START_HOUR = 7;
    const END_HOUR = 20;

    // --- Element references ---
    const mainTitle = document.getElementById('main-title');
    const timeColumn = document.querySelector('.time-column');
    const instructorFilter = document.getElementById('instructor-filter');
    const typeFiltersContainer = document.getElementById('type-filters'); // replaced single-select with container
    const locationFilter = document.getElementById('location-filter');
    const courseCheckboxesContainer = document.getElementById('course-checkboxes');
    const semesterSelect = document.getElementById('semester-select');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const showAllChenBtn = document.getElementById('show-all-chen-btn');
    const legendContainer = document.getElementById('legend');
    const metricsContainer = document.getElementById('metrics');
    const archiveList = document.getElementById('archive-list');

    // --- Initialization ---
    generateTimeSlots();

    // load list of semesters (this is your original implementation)
    fetch('data/semesters.json')
        .then(res => res.json())
        .then(semesters => {
            semesters.forEach(s => {
                const option = document.createElement('option');
                option.value = s.data_file;
                option.textContent = s.display_title;
                semesterSelect.appendChild(option);
            });
            if (semesterSelect.options.length > 0) {
                semesterSelect.value = semesterSelect.options[0].value;
                loadSemesterData(semesterSelect.value);
            }
        });

    // --- helpers & data loading ---
    function loadSemesterData(semesterFile) {
        fetch(semesterFile)
            .then(res => res.json())
            .then(semester => {
                siteConfig = semester;
                mainTitle.innerText = `${semester.display_title} — CH-EN Course Schedule`;
                allCourses = semester.courses.map(course => {
                    // normalize time strings to minutes, etc.
                    const timeString = course.time || '';
                    const timeParts = timeString.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
                    if (!timeParts) {
                        return { ...course, startMinutes: null, endMinutes: null };
                    }
                    const [time, ampm] = [timeParts[1], timeParts[2].toUpperCase()];
                    let [hour, minute] = time.split(':').map(Number);
                    if (ampm === 'PM' && hour !== 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;
                    const startMinutes = (hour * 60) + minute;
                    const endMinutes = startMinutes + course.duration;
                    return { ...course, startMinutes, endMinutes };
                });
                
                resetAndRepopulateAllFilters(allCourses);
                filterAndRedrawCalendar();
            })
            .catch(error => console.error(`[FATAL] Error loading schedule data for ${semester.display_title}:`, error));
    }
    
    // --- EVENT LISTENERS (with all advanced logic restored) ---
    semesterSelect.addEventListener('change', (e) => loadSemesterData(e.target.value));

    instructorFilter.addEventListener('change', () => {
        const selectedInstructor = instructorFilter.value;
        // clear type checkboxes when instructor dropdown is used
        if (typeFiltersContainer) { typeFiltersContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); }
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            if (selectedInstructor === 'all') { return; }
            cb.checked = (course && course.instructors && course.instructors.includes(selectedInstructor));
        });
        filterAndRedrawCalendar();
    });

    typeFiltersContainer.addEventListener('change', () => {
        const checkedTypes = Array.from(typeFiltersContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        // clear other dropdowns (they override checkbox filters)
        if (instructorFilter) instructorFilter.value = 'all';
        if (locationFilter) locationFilter.value = 'all';

        // If none checked, leave course checkbox states alone (user can manually control them).
        if (checkedTypes.length === 0) {
            filterAndRedrawCalendar();
            return;
        }

        // Update course checkboxes to match selected types (if course.type includes any of the checked types)
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            cb.checked = !!(course && course.type && checkedTypes.some(t => course.type.includes(t)));
        });

        filterAndRedrawCalendar();
    });

    // --- THIS IS THE NEWLY ADDED LOGIC ---
    locationFilter.addEventListener('change', () => {
        const selectedLocation = locationFilter.value;
        // clear type checkboxes when location dropdown is used
        if (typeFiltersContainer) { typeFiltersContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); }
        instructorFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            if (selectedLocation === 'all') { return; }
            cb.checked = (course && course.location && course.location.includes(selectedLocation));
        });
        filterAndRedrawCalendar();
    });

    resetFiltersBtn.addEventListener('click', () => {
        resetAndRepopulateAllFilters(allCourses);
        filterAndRedrawCalendar();
    });

    showAllChenBtn.addEventListener('click', () => {
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = cb.value.startsWith('CH') || cb.value.startsWith('EN'));
        filterAndRedrawCalendar();
    });

    // --- Filter / drawing functions ---
    function resetAndRepopulateAllFilters(courses) {
        Array.from(instructorFilter.options).slice(1).forEach(opt => opt.remove());
        instructorFilter.value = 'all';
        // clear existing type checkboxes / container
        typeFiltersContainer.innerHTML = '';
        Array.from(locationFilter.options).slice(1).forEach(opt => opt.remove());
        locationFilter.value = 'all';
        courseCheckboxesContainer.innerHTML = '';
        populateFilters(courses);
    }

    function courseToHslColor(course) {
        const typeBaseHues = {
            'Year 1': 220,  'Freshman': 220,
            'Year 2': 160,  'Sophomore': 160,
            'Year 3': 50,  'Junior': 50,
            'Year 4': 0,   'Senior': 0,
            'Elective': 280, 
            'Graduate': 30, 
            'Other': 300,
        };
        const primaryType = (course.type || '').split(',')[0].trim();
        let baseHue = typeBaseHues[primaryType] ?? 0;
        let saturation = 65;
        if (typeBaseHues[primaryType] === undefined) {
            saturation = 0;
        }
        let hash = 0;
        const str = course.course_number;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hueVariation = (hash % 21) - 10;
        return `hsl(${baseHue + hueVariation}, ${saturation}%, 70%)`;
    }

    function generateTimeSlots() {
        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.classList.add('time-slot');
            timeSlot.innerText = `${hour}:00`;
            timeColumn.appendChild(timeSlot);
        }
    }
    
    function populateFilters(courses) {
        courseColorMap.clear();
        courses.forEach(course => {
            if (!courseColorMap.has(course.course_number)) {
                courseColorMap.set(course.course_number, courseToHslColor(course));
            }
        });
        const uniqueCourses = [...new Set(courses.map(course => course.course_number))].sort();
        
        const allInstructorNames = courses.flatMap(course => (course.instructors || '').split(';').map(name => name.trim()));
        const uniqueInstructors = [...new Set(allInstructorNames)].filter(Boolean).sort();
        uniqueInstructors.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            instructorFilter.appendChild(option);
        });

        const allTypeNames = courses.flatMap(course => (course.type || '').split(',').map(name => name.trim()));
        const uniqueTypes = [...new Set(allTypeNames)].filter(Boolean).sort();
        // create checkboxes for types
        uniqueTypes.forEach(typeName => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checkbox-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `type-${typeName.replace(/\s+/g, '-')}`;
            checkbox.value = typeName;
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = typeName;
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            typeFiltersContainer.appendChild(itemDiv);
        });

        const allLocationNames = courses.flatMap(course => (course.location || '').split(';').map(name => name.trim()));
        const uniqueLocations = [...new Set(allLocationNames)].filter(Boolean).sort();
        uniqueLocations.forEach(locationName => {
            const option = document.createElement('option');
            option.value = locationName;
            option.textContent = locationName;
            locationFilter.appendChild(option);
        });

        courseCheckboxesContainer.innerHTML = '';
        uniqueCourses.forEach(courseName => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checkbox-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `course-${courseName}`;
            checkbox.value = courseName;
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = courseName;
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            courseCheckboxesContainer.appendChild(itemDiv);
        });
    }

    function clearCalendarGrid() {
        document.querySelectorAll('.day-content').forEach(dayDiv => dayDiv.innerHTML = '');
    }

    function filterAndRedrawCalendar() {
        const selectedInstructor = instructorFilter.value;
        const selectedLocation = locationFilter.value;
        const checkedTypeValues = Array.from(typeFiltersContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const selectedCourses = Array.from(document.querySelectorAll('#course-checkboxes input:checked')).map(cb => cb.value);
        
        const filteredCourses = allCourses.filter(course => {
            const instructorMatch = (selectedInstructor === 'all' || (course.instructors && course.instructors.includes(selectedInstructor)));
            // type matching handled below via checkedTypeValues when dropdowns are not active
            const typeMatch = true;
            const locationMatch = (selectedLocation === 'all' || (course.location && course.location.includes(selectedLocation)));
            
            // If any dropdown is active, checkbox selection is ignored for filtering
            if (selectedInstructor !== 'all' || selectedLocation !== 'all') {
                return instructorMatch && typeMatch && locationMatch;
            }
            
            // If all dropdowns are 'all', filter by selected courses OR by checked type checkboxes
            if (selectedCourses.length > 0) {
                return selectedCourses.includes(course.course_number);
            }
            if (checkedTypeValues.length > 0) {
                return (course.type && checkedTypeValues.some(t => course.type.includes(t)));
            }
            return true;
        });
        
        const schedulableCourses = filteredCourses.filter(c => c.startMinutes !== null && c.days && c.days.trim() !== '');
        const unschedulableCourses = filteredCourses.filter(c => c.startMinutes === null || !c.days || c.days.trim() === '');

        // redraw calendar grid
        clearCalendarGrid();
        schedulableCourses.forEach(course => {
            const color = courseColorMap.get(course.course_number) || '#ddd';
            const courseDiv = document.createElement('div');
            courseDiv.className = 'course-block';
            courseDiv.style.background = color;
            courseDiv.innerText = `${course.course_number}\n${course.time || ''}\n${course.location || ''}`;
            // naive placement: append to first day matching
            if (course.days) {
                const dayChars = course.days.split('');
                dayChars.forEach(d => {
                    const dayContent = document.querySelector(`.day-content[data-day="${d}"]`);
                    if (dayContent) {
                        dayContent.appendChild(courseDiv.cloneNode(true));
                    }
                });
            }
        });

        // legend + metrics
        legendContainer.innerHTML = '';
        const legendItems = new Set(filteredCourses.map(c => c.course_number));
        legendItems.forEach(courseNum => {
            const li = document.createElement('div');
            li.className = 'legend-item';
            li.innerText = courseNum;
            legendContainer.appendChild(li);
        });

        metricsContainer.innerHTML = `<div>Total courses: ${filteredCourses.length}</div>
            <div>Schedulable: ${schedulableCourses.length}</div>
            <div>Unschedulable: ${unschedulableCourses.length}</div>`;
        
        // archive list render (for any unschedulable ones, etc.)
        archiveList.innerHTML = '';
        unschedulableCourses.forEach(c => {
            const p = document.createElement('p');
            p.textContent = `${c.course_number} — ${c.title || ''} (${c.time || 'no time'})`;
            archiveList.appendChild(p);
        });
    }

    // initial call if data already available
    // (otherwise triggered after load)
});
