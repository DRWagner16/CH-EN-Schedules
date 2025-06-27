document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('electives-table-body');
    const programFilter = document.getElementById('program-filter');
    const frequencyFilter = document.getElementById('frequency-filter');
    const certaintyFilter = document.getElementById('certainty-filter');
    const electiveGrid = document.getElementById('elective-grid');

    let allElectives = [];

    fetch('electives.json')
        .then(response => response.json())
        .then(data => {
            allElectives = data;
            populateElectiveFilters(data);
            filterAndDisplayElectives();
        })
        .catch(error => {
            console.error('Error fetching electives data:', error);
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Error: Could not load electives.json.</td></tr>`;
        });

    function populateElectiveFilters(courses) {
        const programs = new Set();
        const frequencies = new Set();
        const certainties = new Set();

        courses.forEach(course => {
            (course.Program || '').split(';').forEach(p => p.trim() && programs.add(p.trim()));
            if (course['Offering Frequency']) frequencies.add(course['Offering Frequency']);
            if (course.Certainty) certainties.add(course.Certainty);
        });

        const populate = (filterElement, items) => {
            Array.from(items).sort().forEach(item => {
                const option = document.createElement('option');
                option.value = item;
                option.textContent = item;
                filterElement.appendChild(option);
            });
        };

        populate(programFilter, programs);
        populate(frequencyFilter, frequencies);
        populate(certaintyFilter, certainties);
    }

    function filterAndDisplayElectives() {
        const selectedProgram = programFilter.value;
        const selectedFrequency = frequencyFilter.value;
        const selectedCertainty = certaintyFilter.value;

        const filteredCourses = allElectives.filter(course => {
            const programMatch = selectedProgram === 'all' || (course.Program && course.Program.includes(selectedProgram));
            const frequencyMatch = selectedFrequency === 'all' || course['Offering Frequency'] === selectedFrequency;
            const certaintyMatch = selectedCertainty === 'all' || course.Certainty === selectedCertainty;
            return programMatch && frequencyMatch && certaintyMatch;
        });

        // Call both display functions
        displayOfferingGrid(filteredCourses);
        displayElectivesTable(filteredCourses);
    }
    
    function displayOfferingGrid(courses) {
        electiveGrid.innerHTML = ''; // Clear previous grid

        // Create headers
        const currentYear = new Date().getFullYear();
        const headers = ['Course', 'Title'];
        const semesterCodes = [];
        for (let i = 0; i < 5; i++) {
            const year = currentYear + i;
            headers.push(`FA${String(year).slice(-2)}`);
            semesterCodes.push(`FA${String(year).slice(-2)}`);
            headers.push(`SP${String(year + 1).slice(-2)}`);
            semesterCodes.push(`SP${String(year + 1).slice(-2)}`);
        }
        headers.forEach(header => {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'grid-header';
            headerDiv.textContent = header;
            electiveGrid.appendChild(headerDiv);
        });

        // Create rows
        courses.forEach(course => {
            const courseNumCell = document.createElement('div');
            courseNumCell.className = 'grid-cell course-name';
            const ug = course['Course Number (UG)'] || '';
            const gr = course['Course Number (GR)'] || '';
            courseNumCell.textContent = ug ? `${ug} / ${gr}` : gr || ug;
            electiveGrid.appendChild(courseNumCell);

            const courseTitleCell = document.createElement('div');
            courseTitleCell.className = 'grid-cell course-name';
            courseTitleCell.textContent = course['Course Title'] || '';
            electiveGrid.appendChild(courseTitleCell);

            const schedule = course.predicted_schedule || [];
            semesterCodes.forEach(semCode => {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                if (schedule.includes(semCode)) {
                    cell.textContent = '✔️';
                    if (course.Certainty === 'Confirmed') cell.classList.add('offered');
                    if (course.Certainty === 'Tentative') cell.classList.add('offered-tentative');
                    if (course.Certainty === 'Planned') cell.classList.add('offered-planned');
                }
                electiveGrid.appendChild(cell);
            });
        });
    }

    function displayElectivesTable(courses) {
        tableBody.innerHTML = '';
        if (courses.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 10;
            cell.textContent = 'No electives match the current filter selection.';
            cell.style.textAlign = 'center';
            return;
        }

        courses.forEach(course => {
            const row = tableBody.insertRow();
            const ug = course['Course Number (UG)'] || '';
            const gr = course['Course Number (GR)'] || '';
            let courseDisplay = ug;
            if (gr) {
                courseDisplay = ug ? `${ug} / ${gr}` : gr;
            }
            
            row.insertCell().textContent = courseDisplay;
            row.insertCell().textContent = course['Course Title'] || '';
            row.insertCell().textContent = course.Program || '';
            row.insertCell().textContent = course['Offering Frequency'] || '';
            row.insertCell().textContent = course['Next Offering'] || 'TBD';
            row.insertCell().textContent = course['Last Offered'] || '';
            row.insertCell().textContent = course.Certainty || '';
            row.insertCell().textContent = course.Format || '';
            row.insertCell().textContent = course['Potential Instructors'] || '';
            row.insertCell().textContent = course.Notes || '';
        });
    }

    programFilter.addEventListener('change', filterAndDisplayElectives);
    frequencyFilter.addEventListener('change', filterAndDisplayElectives);
    certaintyFilter.addEventListener('change', filterAndDisplayElectives);
});
