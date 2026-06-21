document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('electives-table-body');
    const programFilter = document.getElementById('program-filter');
    const frequencyFilter = document.getElementById('frequency-filter');
    const certaintyFilter = document.getElementById('certainty-filter');
    const electiveGrid = document.getElementById('elective-grid');

    let allElectives = [];

    // --- THE SOURCE OF TRUTH (Matches builder.html) ---
    const builderEmphases = {
        "Energy Engineering": ['4870', '5205', '5305', '5308', '5310', '5555'],
        "Biochemical": ['5103', '5230', '5840', '5310', '5555'],
        "Environmental": ['3780', '4870', '5305', '5306', '5308', '5310', '5555'],
        "Semiconductor": ['5655', '5203', '5205', '5208', '5230', '5305', '5308'],
        "AI": ['5203', '5205', '5208', '5306', '5103']
    };

    fetch('electives.json')
        .then(response => response.json())
        .then(data => {
            
            // --- THE INTERCEPTOR ---
            data.forEach(course => {
                const ug = (course['Course Number (UG)'] || '').toString().trim();
                const gr = (course['Course Number (GR)'] || '').toString().trim();
                const courseNums = [ug, gr].filter(Boolean);

                let mappedPrograms = [];
                
                for (const [empName, coreCourses] of Object.entries(builderEmphases)) {
                    // Fuzzy match to catch '5103 / 6103' formats
                    if (coreCourses.some(num => courseNums.some(cn => cn.includes(num)))) {
                        mappedPrograms.push(empName);
                    }
                }

                // FIX: Instead of overwriting course.Program (which breaks the filter), 
                // we store the emphases in a new, hidden property specifically for the calculator.
                course.EmphasisTags = mappedPrograms; 
            });

            allElectives = data;
            populateElectiveFilters(data);
            filterAndDisplayElectives();
            
            // Run the calculator using our freshly mapped data
            calculateEmphasisCoverage(data); 
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
            // Now this safely reads the original Google Sheet values again!
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

        displayOfferingGrid(filteredCourses);
        displayElectivesTable(filteredCourses);
    }
    
    // --- EMPHASIS CALCULATOR ENGINE ---
    function calculateEmphasisCoverage(courses) {
        const emphases = Object.keys(builderEmphases); 
        const currentYear = new Date().getFullYear();
        
        const validSemesters = [];
        for (let i = 0; i <= 2; i++) {
            const yy = String(currentYear + i).slice(-2);
            validSemesters.push(`FA${yy}`, `SP${yy}`, `SU${yy}`);
        }
        
        let coverage = {};
        emphases.forEach(e => coverage[e] = { total: 0, compliant: 0, missing: [] });

        courses.forEach(course => {
            // Read from our new hidden array instead of course.Program
            const tags = course.EmphasisTags || [];
            const ug = course['Course Number (UG)'];
            const gr = course['Course Number (GR)'];
            const courseName = ug ? ug : (gr ? gr : 'Unknown');
            
            let isCompliant = false;

            const schedule = course.predicted_schedule || [];
            if (Array.isArray(schedule) && schedule.length > 0) {
                isCompliant = schedule.some(sem => validSemesters.includes(sem));
            } else if (typeof schedule === 'string' && schedule.trim() !== '') {
                isCompliant = validSemesters.some(sem => schedule.includes(sem));
            }
            
            if (!isCompliant) {
                const nextOffering = course['Next Offering'] || "";
                const yearMatch = nextOffering.match(/\d{4}/);
                if (yearMatch) {
                    const offeringYear = parseInt(yearMatch[0], 10);
                    if (offeringYear <= currentYear + 2) {
                        isCompliant = true;
                    }
                }
            }
            
            emphases.forEach(emp => {
                if (tags.includes(emp)) {
                    coverage[emp].total++;
                    if (isCompliant) {
                        coverage[emp].compliant++;
                    } else {
                        coverage[emp].missing.push(courseName);
                    }
                }
            });
        });
        
        renderCoverageResults(coverage);
    }

    function renderCoverageResults(coverage) {
        const container = document.getElementById("coverage-results");
        container.innerHTML = "";
        
        for (const [emp, data] of Object.entries(coverage)) {
            const isSatisfied = data.total > 0 && data.missing.length === 0; 
            
            const color = isSatisfied ? "#2e7d32" : "#c62828";
            const bgColor = isSatisfied ? "#e8f5e9" : "#ffebee";
            
            let html = `
                <div style="padding: 10px; border-left: 4px solid ${color}; background: ${bgColor}; border-radius: 0 4px 4px 0;">
                    <h4 style="margin: 0 0 5px 0;">${emp}</h4>
                    <p style="margin: 0; font-size: 0.9em;">
                        Status: <strong style="color: ${color}">${isSatisfied ? 'Compliant' : 'Action Required'}</strong><br>
                        Courses <= 2 years: ${data.compliant} / ${data.total}
                    </p>
            `;
            
            if (!isSatisfied && data.missing.length > 0) {
                html += `<p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">
                         <em>At Risk: ${data.missing.join(", ")}</em></p>`;
            }
            
            html += `</div>`;
            container.innerHTML += html;
        }
    }

    function displayOfferingGrid(courses) {
        electiveGrid.innerHTML = ''; 

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
