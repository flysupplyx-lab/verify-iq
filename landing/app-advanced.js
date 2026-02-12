// ===== ADVANCED LANDING PAGE JAVASCRIPT =====

// Sticky Navigation Scroll Effect
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// ===== REVENUE CHART (Chart.js) =====
const ctx = document.getElementById('revenueChart').getContext('2d');
const revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
        datasets: [{
            label: 'Revenue ($)',
            data: [
                5200, 6100, 5800, 7200, 6900, 7500, 8100, 7800, 8500, 9200,
                8800, 9500, 10200, 9800, 10500, 11200, 10800, 11500, 12200, 11800,
                12500, 13200, 12800, 13500, 14200, 13800, 14500, 15200, 14800, 15500
            ],
            borderColor: '#1a73e8',
            backgroundColor: 'rgba(26, 115, 232, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#1a73e8',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(9, 9, 11, 0.95)',
                titleColor: '#fafafa',
                bodyColor: '#a1a1aa',
                borderColor: 'rgba(26, 115, 232, 0.3)',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        return '$' + context.parsed.y.toLocaleString();
                    }
                }
            }
        },
        scales: {
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#71717a',
                    callback: function (value) {
                        return '$' + (value / 1000) + 'k';
                    }
                }
            },
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#71717a',
                    maxTicksLimit: 10
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    }
});

// ===== DATA TABLE =====
const tableData = [
    { date: '2026-02-11', action: 'URL Scan', status: 'completed', user: 'john@example.com' },
    { date: '2026-02-11', action: 'Dark Web Search', status: 'completed', user: 'jane@example.com' },
    { date: '2026-02-11', action: 'Supplier Score', status: 'pending', user: 'mike@example.com' },
    { date: '2026-02-10', action: 'Bulk Scan', status: 'completed', user: 'sarah@example.com' },
    { date: '2026-02-10', action: 'URL Scan', status: 'completed', user: 'alex@example.com' },
    { date: '2026-02-10', action: 'Dark Web Search', status: 'pending', user: 'chris@example.com' },
    { date: '2026-02-09', action: 'Supplier Score', status: 'completed', user: 'emma@example.com' },
    { date: '2026-02-09', action: 'URL Scan', status: 'completed', user: 'david@example.com' },
    { date: '2026-02-09', action: 'Bulk Scan', status: 'pending', user: 'lisa@example.com' },
    { date: '2026-02-08', action: 'Dark Web Search', status: 'completed', user: 'tom@example.com' },
    { date: '2026-02-08', action: 'URL Scan', status: 'completed', user: 'amy@example.com' },
    { date: '2026-02-08', action: 'Supplier Score', status: 'completed', user: 'ryan@example.com' },
    { date: '2026-02-07', action: 'URL Scan', status: 'pending', user: 'kate@example.com' },
    { date: '2026-02-07', action: 'Bulk Scan', status: 'completed', user: 'mark@example.com' },
    { date: '2026-02-07', action: 'Dark Web Search', status: 'completed', user: 'nina@example.com' },
];

let currentPage = 1;
const rowsPerPage = 5;
let sortColumn = 'date';
let sortDirection = 'desc';

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    // Sort data
    const sortedData = [...tableData].sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        if (sortColumn === 'date') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    const pageData = sortedData.slice(start, end);

    tbody.innerHTML = pageData.map(row => `
        <tr>
            <td>${row.date}</td>
            <td>${row.action}</td>
            <td><span class="status-badge status-${row.status}">${row.status}</span></td>
            <td>${row.user}</td>
        </tr>
    `).join('');

    // Update pagination
    const totalPages = Math.ceil(tableData.length / rowsPerPage);
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;

    // Update button states
    document.querySelector('[data-page="prev"]').disabled = currentPage === 1;
    document.querySelector('[data-page="next"]').disabled = currentPage === totalPages;
}

// Table sorting
document.querySelectorAll('.activity-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;

        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'desc';
        }

        // Update sort icons
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.textContent = '↕';
        });
        th.querySelector('.sort-icon').textContent = sortDirection === 'asc' ? '↑' : '↓';

        renderTable();
    });
});

// Pagination
document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.page;
        const totalPages = Math.ceil(tableData.length / rowsPerPage);

        if (action === 'prev' && currentPage > 1) {
            currentPage--;
        } else if (action === 'next' && currentPage < totalPages) {
            currentPage++;
        }

        renderTable();
    });
});

// Sidebar toggle
const sidebar = document.getElementById('tableSidebar');
const toggleBtn = document.getElementById('toggleSidebar');
toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// Initial render
renderTable();

// ===== TABBED SERVICES =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Remove active class from all buttons and panels
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        // Add active class to clicked button and corresponding panel
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// ===== ANIMATED COUNTERS =====
const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const animateCounter = (element) => {
    const target = parseInt(element.dataset.target);
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
};

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.textContent === '0') {
            animateCounter(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.stat-number').forEach(el => {
    counterObserver.observe(el);
});

// ===== TEAM SLIDER =====
let teamIndex = 0;
const teamTrack = document.getElementById('teamTrack');
const teamCards = document.querySelectorAll('.team-card');
const prevBtn = document.getElementById('teamPrev');
const nextBtn = document.getElementById('teamNext');

function updateTeamSlider() {
    const cardWidth = teamCards[0].offsetWidth + 24; // card width + gap
    teamTrack.style.transform = `translateX(-${teamIndex * cardWidth}px)`;
}

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
        if (teamIndex > 0) {
            teamIndex--;
            updateTeamSlider();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (teamIndex < teamCards.length - 4) {
            teamIndex++;
            updateTeamSlider();
        }
    });
}

// ===== FAQ ACCORDION =====
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const isOpen = item.classList.contains('active');

        // Close all items
        document.querySelectorAll('.faq-item').forEach(i => {
            i.classList.remove('active');
            i.querySelector('.faq-icon').textContent = '+';
        });

        // Open clicked item if it wasn't open
        if (!isOpen) {
            item.classList.add('active');
            btn.querySelector('.faq-icon').textContent = '−';
        }
    });
});

// ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

console.log('✅ VerifyIQ Advanced Landing Page Loaded');
