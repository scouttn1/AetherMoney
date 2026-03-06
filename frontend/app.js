import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    projectId: "aether-money-1772793504",
    appId: "1:461108404902:web:d068c9cc5ef13fd09e8a67",
    storageBucket: "aether-money-1772793504.firebasestorage.app",
    apiKey: "AIzaSyBkEwDbaOi3JjynUAcTls_mrSe6hYSOsWQ",
    authDomain: "aether-money-1772793504.firebaseapp.com",
    messagingSenderId: "461108404902"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let spendingChart;

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').innerHTML = `
            ${user.displayName} 
            <br><span style="font-size: 0.6rem; color: #666; cursor: pointer;" onclick="navigator.clipboard.writeText('${user.uid}'); alert('UID 已复制')">
                UID: ${user.uid.substring(0, 8)}... (点击复制)
            </span>
        `;
        document.getElementById('user-photo').src = user.photoURL;

        // Load data from Firestore
        initFirestoreSync();
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        // Clear data or show login placeholder
    }
});

async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Auth Error:", error);
    }
}

async function logout() {
    await signOut(auth);
}

// Firestore Sync
function initFirestoreSync() {
    const billsRef = collection(db, "users", currentUser.uid, "bills");
    const q = query(billsRef, orderBy("timestamp", "desc"), limit(20));

    onSnapshot(q, (snapshot) => {
        const bills = [];
        snapshot.forEach((doc) => bills.push({ id: doc.id, ...doc.data() }));
        renderDashboard(bills);
    });
}

function renderDashboard(bills) {
    // Summary
    const totalSpent = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    document.getElementById('month-spent').innerText = `¥ ${totalSpent.toLocaleString()}`;

    // Net wealth placeholder (could fetch from investment collection)
    document.getElementById('net-wealth').innerText = `¥ ${(0 - totalSpent).toLocaleString()}`;

    // List
    const transactionList = document.getElementById('transaction-list');
    transactionList.innerHTML = bills.length ? '' : '<div style="text-align: center; color: #94a3b8; padding: 2rem;">暂无账单数据</div>';

    bills.forEach(bill => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="tr-info">
                <div class="tr-name">${bill.source || 'Manual'} ${bill.description || ''}</div>
                <div class="tr-date">${bill.timestamp?.toDate ? bill.timestamp.toDate().toLocaleDateString() : '刚刚'}</div>
            </div>
            <div class="tr-amount">¥ ${bill.amount.toFixed(2)}</div>
        `;
        transactionList.appendChild(item);
    });

    // Chart trend (group by day)
    updateSpendingChart(bills);
}

function updateSpendingChart(bills) {
    const ctx = document.getElementById('spendingChart').getContext('2d');

    // Simple group by date
    const trend = {};
    bills.forEach(b => {
        const date = b.timestamp?.toDate ? b.timestamp.toDate().toLocaleDateString() : new Date().toLocaleDateString();
        trend[date] = (trend[date] || 0) + b.amount;
    });

    const labels = Object.keys(trend).reverse();
    const data = Object.values(trend).reverse();

    if (spendingChart) spendingChart.destroy();

    spendingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '支出 (¥)',
                data: data,
                borderColor: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

// Global functions for HTML access
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.submitBill = async function () {
    if (!currentUser) return alert("请先登录");
    const rawText = document.getElementById('raw-bill').value;
    if (!rawText) return;

    // Use a simple mock parser as logic is now on client side
    const amountMatch = rawText.match(/(\d+\.?\d*)元/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    await addDoc(collection(db, "users", currentUser.uid, "bills"), {
        amount: amount,
        description: rawText,
        source: "Mobile",
        timestamp: serverTimestamp()
    });

    document.getElementById('raw-bill').value = '';
};

window.submitInvestment = async function () {
    if (!currentUser) return alert("请先登录");
    const name = document.getElementById('inv-name').value;
    const pl = parseFloat(document.getElementById('inv-pl').value);

    if (!name || isNaN(pl)) return;

    await addDoc(collection(db, "users", currentUser.uid, "investments"), {
        name,
        profit_loss: pl,
        timestamp: serverTimestamp()
    });

    document.getElementById('inv-name').value = '';
    document.getElementById('inv-pl').value = '';
};
