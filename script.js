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
    const typeFilter = document.getElementById('type-filter');
    const locationFilter = document.getElementById('location-filter');
    const courseCheckboxesContainer = document.getElementById('course-checkboxes');
    const resetBtn = document.getElementById('reset-filters');
    const showAllChenBtn = document.getElementById('show-all-chen-btn');
    const unscheduledCoursesList = document.getElementById('unscheduled-courses-list');
    const courseTableBody = document.getElementById('course-table-body');
    const semesterSelect = document.getElementById('semester-select');

    // --- Main initialization logic ---
    function initializeApp() {
        generateTimeSlots();
        
        fetch('config.json')
            .then(response => {
                if (!response.ok) { throw new Error("Network response was not ok for config.json"); }
                return response.json();
            })
            .then(config => {
                siteConfig = config;
                populateSemesterSelector();
                loadSemesterData(config.current_semester_id);
            })
            .catch(error => console.error('[FATAL] Could not load config.json:', error));
    }

    function populateSemesterSelector() {
        if (!siteConfig.semesters || !semesterSelect) return;
        semesterSelect.innerHTML = '';
        siteConfig.semesters.forEach(semester => {
            const option = document.createElement('option');
            option.value = semester.id;
            option.textContent = semester.display_title;
            semesterSelect.appendChild(option);
        });
        semesterSelect.value = siteConfig.current_semester_id;
    }

    function loadSemesterData(semesterId) {
        const semester = siteConfig.semesters.find(s => s.id === semesterId);
        if (!semester) {
            console.error(`Semester with id ${semesterId} not found in config.`);
            return;
        }

        if(mainTitle) mainTitle.textContent = semester.display_title + " Course Schedule";

        fetch(semester.output_json_file)
            .then(response => {
                if (!response.ok) { throw new Error(`Could not load ${semester.output_json_file}`); }
                return response.json();
            })
            .then(data => {
                allCourses = data.map(course => {
                    const timeString = course.time_of_day;
                    if (!timeString || !timeString.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i)) {
                        return { ...course, startMinutes: null, endMinutes: null };
                    }
                    const timeParts = timeString.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
                    const [time, ampm] = [timeParts[1], timeParts[2].toUpperCase()];
                    let [hour, minute] = time.split(':').map(Number);
                    if (ampm === 'PM' && hour !== 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;
                    const startMinutes = (hour * 60) + minute;
                    const endMinutes = startMinutes + course.duration;
                    return { ...course, startMinutes, endMinutes };
                });
                
                resetAllFilters();
                populateFilters(allCourses);
                filterAndRedrawCalendar();
            })
            .catch(error => console.error(`[FATAL] Error loading schedule data for ${semester.display_title}:`, error));
    }
    
    // --- EVENT LISTENERS (Restored from old script) ---
    semesterSelect.addEventListener('change', (e) => loadSemesterData(e.target.value));

    instructorFilter.addEventListener('change', () => {
        const selectedInstructor = instructorFilter.value;
        if (selectedInstructor === 'all') { filterAndRedrawCalendar(); return; }
        typeFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            cb.checked = (course && course.instructors && course.instructors.includes(selectedInstructor));
        });
        filterAndRedrawCalendar();
    });

    typeFilter.addEventListener('change', () => {
        const selectedType = typeFilter.value;
        if (selectedType === 'all') { filterAndRedrawCalendar(); return; }
        instructorFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            cb.checked = (course && course.type && course.type.includes(selectedType));
        });
        filterAndRedrawCalendar();
    });

    locationFilter.addEventListener('change', filterAndRedrawCalendar);
    courseCheckboxesContainer.addEventListener('change', filterAndRedrawCalendar);

    resetBtn.addEventListener('click', () => {
        resetAllFilters();
        filterAndRedrawCalendar();
    });
    
    showAllChenBtn.addEventListener('click', () => {
        resetAllFilters();
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            cb.checked = cb.value.startsWith("CH EN");
        });
        filterAndRedrawCalendar();
    });

    function resetAllFilters() {
        if (instructorFilter) {
            Array.from(instructorFilter.options).slice(1).forEach(opt => opt.remove());
            instructorFilter.value = 'all';
        }
        if (typeFilter) {
            Array.from(typeFilter.options).slice(1).forEach(opt => opt.remove());
            typeFilter.value = 'all';
        }
        if (locationFilter) {
            Array.from(locationFilter.options).slice(1).forEach(opt => opt.remove());
            locationFilter.value = 'all';
        }
        if (courseCheckboxesContainer) courseCheckboxesContainer.innerHTML = '';
    }

    // --- COLOR FUNCTION (Restored from old script) ---
    function courseToHslColor(course) {
        const typeBaseHues = {
            'Year 1': 210, 'First-year': 210, 'Sophomore': 120, 'Junior': 50,
            'Senior': 0, 'Elective': 280, 'Graduate': 30, 'Other': 300,
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
        uniqueTypes.forEach(typeName => {
            const option = document.createElement('option');
            option.value = typeName;
            option.textContent = typeName;
            typeFilter.appendChild(option);
        });

        const allLocationNames = courses.flatMap(course => (course.location || '').split(';').map(name => name.trim()));
        const uniqueLocations = [...new Set(allLocationNames)].filter(Boolean).sort();
        uniqueLocations.forEach(locationName => {
            const option = document.createElement('option');
            option.value = locationName;
            option.textContent = locationName;
            locationFilter.appendChild(option);
        });

        uniqueCourses.forEach(courseName => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checkbox-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = courseName;
            checkbox.value = courseName;
            const label = document.createElement('label');
            label.htmlFor = courseName;
            label.textContent = courseName;
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            courseCheckboxesContainer.appendChild(itemDiv);
        });
    }

    function filterAndRedrawCalendar() {
        const selectedInstructor = instructorFilter.value;
        const selectedType = typeFilter.value;
        const selectedLocation = locationFilter.value;
        const selectedCourses = Array.from(document.querySelectorAll('#course-checkboxes input:checked')).map(cb => cb.value);
        
        const filteredCourses = allCourses.filter(course => {
            const instructorMatch = (selectedInstructor === 'all' || (course.instructors && course.instructors.includes(selectedInstructor)));
            const typeMatch = (selectedType === 'all' || (course.type && course.type.includes(selectedType)));
            const locationMatch = (selectedLocation === 'all' || (course.location && course.location.includes(selectedLocation)));
            const courseMatch = (selectedCourses.length === 0 || selectedCourses.includes(course.course_number));
            return instructorMatch && typeMatch && courseMatch && locationMatch;
        });
        
        const schedulableCourses = filteredCourses.filter(c => c.startMinutes !== null && c.days && c.days.trim() !== '');
        const unschedulableCourses = filteredCourses.filter(c => c.startMinutes === null || !c.days || c.days.trim() === '');
        
        updateCoursesTable(filteredCourses);
        calculateAndDisplayMetrics(schedulableCourses);
        displayUnscheduledCourses(unschedulableCourses);
        
        document.querySelectorAll('.day-content').forEach(dc => dc.innerHTML = '');

        Object.values(dayMap).forEach(dayCode => {
            const dayEvents = schedulableCourses
                .filter(course => course.days.includes(Object.keys(dayMap).find(key => dayMap[key] === dayCode)))
                .sort((a, b) => a.startMinutes - b.startMinutes);
            if (dayEvents.length === 0) return;
            let columns = [];
            dayEvents.forEach(event => {
                let placed = false;
                for (const column of columns) {
                    const lastEventInColumn = column[column.length - 1];
                    if (event.startMinutes >= lastEventInColumn.endMinutes) {
                        column.push(event);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([event]);
            });
            const totalColumns = columns.length;
            columns.forEach((column, columnIndex) => {
                column.forEach(event => {
                    const width = 100 / totalColumns;
                    const left = columnIndex * width;
                    placeCourseOnCalendar(event, dayCode, width, left);
                });
            });
        });
    }

    function updateCoursesTable(courses) {
        courseTableBody.innerHTML = '';
        const chenCourses = courses.filter(course => course.course_number.startsWith("CH EN"));
        if (chenCourses.length === 0) {
            const row = courseTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 8;
            cell.textContent = 'No CH EN courses match the current filter selection.';
            cell.style.textAlign = 'center';
            return;
        }
        chenCourses.forEach(course => {
            const row = courseTableBody.insertRow();
            row.insertCell().textContent = course.course_number || '';
            row.insertCell().textContent = course.type || '';
            row.insertCell().textContent = course.time_of_day || '';
            row.insertCell().textContent = course.days || '';
            row.insertCell().textContent = course.instructors || '';
            row.insertCell().textContent = course.location || '';
            row.insertCell().textContent = course.anticipated_enrollment || 0;
            row.insertCell().textContent = course.notes || '';
        });
    }

    function displayUnscheduledCourses(courses) {
        unscheduledCoursesList.innerHTML = '';
        if (courses.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No selected courses without a fixed schedule.';
            li.style.fontStyle = 'italic';
            unscheduledCoursesList.appendChild(li);
            return;
        }
        courses.forEach(course => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${course.course_number} (${course.type || 'N/A'})</strong><br>
                Instructor(s): ${course.instructors || 'N/A'}<br>
                Location: ${course.location || 'N/A'}<br>
                ${course.notes ? `Notes: ${course.notes}` : ''}
            `;
            unscheduledCoursesList.appendChild(li);
        });
    }

    function calculateAndDisplayMetrics(courses) {
        const primeTimeStart = 9 * 60;
        const primeTimeEnd = 13 * 60 + 59;
        let mebRoomUsageMinutes = { "MEB 1292": 0, "MEB 2550": 0, "MEB 3520": 0 };
        let dailyMinutes = { Mo: 0, Tu: 0, We: 0, Th: 0, Fr: 0 };
        const uniqueChenCourses = new Set();
        const mwfPrimeTimeCoursesSet = new Set();
        const trPrimeTimeCoursesSet = new Set();
        const mfPrimeTimeCoursesSet = new Set();

        courses.forEach(course => {
            if (course.course_number.startsWith("CH EN") || course.course_number.startsWith("ENGIN")) {
                if (course.duration && course.days) {
                    const courseLocations = (course.location || '').split(';').map(l => l.trim());
                    courseLocations.forEach(loc => {
                        if (loc in mebRoomUsageMinutes) {
                            mebRoomUsageMinutes[loc] += course.duration * course.days.length;
                        }
                    });
                }
            }
            if (!course.course_number.startsWith("CH EN")) return;
            const courseNumStr = course.course_number.replace("CH EN", "").trim();
            const courseNum = parseInt(courseNumStr, 10);
            if (isNaN(courseNum) || courseNum < 1000 || courseNum > 5999) return;
            
            uniqueChenCourses.add(course.course_number);

            const startsInPrimeTime = course.startMinutes >= primeTimeStart && course.startMinutes <= primeTimeEnd;
            if (startsInPrimeTime) {
                mfPrimeTimeCoursesSet.add(course.course_number);
                const isMwfCourse = course.days.includes('M') || course.days.includes('W') || course.days.includes('F');
                const isTrCourse = course.days.includes('T') || course.days.includes('R');
                if (isMwfCourse) mwfPrimeTimeCoursesSet.add(course.course_number);
                if (isTrCourse) trPrimeTimeCoursesSet.add(course.course_number);
            }
            
            for (const dayChar of course.days) {
                const dayCode = dayMap[dayChar];
                if (dayCode) dailyMinutes[dayCode] += course.duration;
            }
        });

        const totalSchedulableChenCourses = uniqueChenCourses.size;
        const mwfPrimeTimeCourseCount = mwfPrimeTimeCoursesSet.size;
        const trPrimeTimeCourseCount = trPrimeTimeCoursesSet.size;
        const mfPrimeTimeCourseCount = mfPrimeTimeCoursesSet.size;
        const totalWeeklyMinutes = Object.values(dailyMinutes).reduce((sum, mins) => sum + mins, 0);

        document.getElementById('metric-meb-1292').textContent = (mebRoomUsageMinutes["MEB 1292"] / 60).toFixed(1);
        document.getElementById('metric-meb-2550').textContent = (mebRoomUsageMinutes["MEB 2550"] / 60).toFixed(1);
        document.getElementById('metric-meb-3520').textContent = (mebRoomUsageMinutes["MEB 3520"] / 60).toFixed(1);
        const mwfPrimePercentage = (totalSchedulableChenCourses > 0) ? (mwfPrimeTimeCourseCount / totalSchedulableChenCourses) * 100 : 0;
        const trPrimePercentage = (totalSchedulableChenCourses > 0) ? (trPrimeTimeCourseCount / totalSchedulableChenCourses) * 100 : 0;
        const mfPrimePercentage = (totalSchedulableChenCourses > 0) ? (mfPrimeTimeCourseCount / totalSchedulableChenCourses) * 100 : 0;
        
        document.getElementById('metric-mwf-prime-pct').textContent = mwfPrimePercentage.toFixed(0);
        document.getElementById('metric-tr-prime-pct').textContent = trPrimePercentage.toFixed(0);
        document.getElementById('metric-mf-prime-pct').textContent = mfPrimePercentage.toFixed(0);
        
        document.getElementById('metric-mwf-prime-count').textContent = mwfPrimeTimeCourseCount;
        document.getElementById('metric-tr-prime-count').textContent = trPrimeTimeCourseCount;
        document.getElementById('metric-mf-prime-count').textContent = mfPrimeTimeCourseCount;
        document.getElementById('metric-total-chen-courses').textContent = totalSchedulableChenCourses;

        document.getElementById('metric-mo-hrs').textContent = (dailyMinutes.Mo / 60).toFixed(1);
        document.getElementById('metric-tu-hrs').textContent = (dailyMinutes.Tu / 60).toFixed(1);
        document.getElementById('metric-we-hrs').textContent = (dailyMinutes.We / 60).toFixed(1);
        document.getElementById('metric-th-hrs').textContent = (dailyMinutes.Th / 60).toFixed(1);
        document.getElementById('metric-fr-hrs').textContent = (dailyMinutes.Fr / 60).toFixed(1);
        document.getElementById('metric-mo-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Mo / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-tu-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Tu / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-we-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.We / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-th-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Th / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-fr-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Fr / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-total-hrs').textContent = (totalWeeklyMinutes / 60).toFixed(1);
    }
    
    function placeCourseOnCalendar(course, day, width = 100, left = 0) {
        const column = document.querySelector(`.day-content[data-day="${day}"]`);
        if (!column) return;
        
        const tooltip = document.getElementById('course-tooltip');
        
        const minutesSinceCalendarStart = course.startMinutes - (START_HOUR * 60);
        const topPosition = minutesSinceCalendarStart;
        const height = course.duration;
        if (!height || topPosition < 0) return;
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'class-event';
        
        eventDiv.style.top = `${topPosition}px`;
        eventDiv.style.height = `${height}px`;
        eventDiv.style.width = `calc(${width}% - 4px)`;
        eventDiv.style.left = `${left}%`;
        
        const color = courseColorMap.get(course.course_number) || '#a3c4f3';
        eventDiv.style.backgroundColor = color;
        eventDiv.style.borderColor = color;
    
        eventDiv.innerHTML = `<div class="event-title">${course.course_number}</div>`;
                
        column.appendChild(eventDiv);
        
        eventDiv.addEventListener('mouseover', () => {
            tooltip.innerHTML = `
                <strong>Course:</strong> ${course.course_number}<br>
                <strong>Instructor:</strong> ${course.instructors}<br>
                <strong>Time:</strong> ${course.time_of_day}<br>
                <strong>Location:</strong> ${course.location}<br>
                <strong>Type:</strong> ${course.type}<br>
                <strong>Duration:</strong> ${course.duration} min<br>
                ${course.notes ? `<strong>Notes:</strong> ${course.notes}<br>` : ''}
                ${course.anticipated_enrollment ? `<strong>Anticipated Enrollment:</strong> ${course.anticipated_enrollment}` : ''}
            `;
            tooltip.style.display = 'block';
        });
    
        eventDiv.addEventListener('mouseout', () => {
            tooltip.style.display = 'none';
            tooltip.innerHTML = ''; 
        });
    
        eventDiv.addEventListener('mousemove', (e) => {
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY + 15 + 'px';
        });
    }

    // --- Start the application ---
    initializeApp();
});
