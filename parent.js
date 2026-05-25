import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, onSnapshot, query, where, orderBy, collection, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ 請用你自己的 Firebase Config 覆蓋此處
const firebaseConfig = {
  apiKey: "AIzaSyChwjaYbKSbIpTMpQtzOlLruxoPm7s1x2o",
  authDomain: "family-moneytracker.firebaseapp.com",
  projectId: "family-moneytracker",
  storageBucket: "family-moneytracker.firebasestorage.app",
  messagingSenderId: "73392429405",
  appId: "1:73392429405:web:7264f6ea7a4df42fe830b4",
  measurementId: "G-VEH094YHQ4"
};

// 1. 安全檢查：驗證家長權限，防止小孩改網址偷進
const sessionData = localStorage.getItem('family_session');
if (!sessionData) {
    alert('未登入，請先登入！');
    window.location.href = 'index.html';
}

const user = JSON.parse(sessionData);
if (user.role !== 'parent') {
    alert('權限不足！此頁面僅限家長存取。');
    window.location.href = 'login.html';
}

// 2. 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById('welcomeText').innerText = `管理主控台：${user.username} 👑`;
document.getElementById('familyInfo').innerText = `家庭同步代號：${user.familyId} (管理端)`;

window.logout = function() {
    localStorage.removeItem('family_session');
    window.location.href = 'login.html';
}

// 3. 雲端即時監聽：錢包餘額與控制台數值
onSnapshot(doc(db, "accounts", user.familyId), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('balanceAmount').innerText = data.balance;
        
        // 低餘額警示
        const alertBanner = document.getElementById('lowBalanceAlert');
        if (data.balance <= data.threshold) {
            alertBanner.classList.remove('hidden');
        } else {
            alertBanner.classList.add('hidden');
        }

        // 當家長沒有在輸入時，自動將雲端最新數值填入輸入框中
        if (document.activeElement !== document.getElementById('setBalanceInput')) {
            document.getElementById('setBalanceInput').value = data.balance;
        }
        if (document.activeElement !== document.getElementById('setThresholdInput')) {
            document.getElementById('setThresholdInput').value = data.threshold;
        }
    }
});

// 4. 雲端即時監聽：所有記帳明細（拆分為審核區與歷史區）
const q = query(
    collection(db, "transactions"),
    where("familyId", "==", user.familyId),
    orderBy("timestamp", "desc")
);

onSnapshot(q, (querySnapshot) => {
    const pendingListEl = document.getElementById('parentPendingList');
    const historyListEl = document.getElementById('parentHistoryList');
    
    pendingListEl.innerHTML = '';
    historyListEl.innerHTML = '';
    
    let hasPending = false;

    querySnapshot.forEach((doc) => {
        const id = doc.id;
        const tx = doc.data();
        let statusText = tx.status === 'pending' ? '待審核' : (tx.status === 'approved' ? '已通過' : '被駁回');
        
        // 渲染至總歷史紀錄明細
        historyListEl.innerHTML += `
            <li class="log-item">
                <div>
                    <strong>[${tx.category}]</strong> $${tx.amount} - ${tx.note}
                    <small>記錄者: ${tx.childName} | 日期: ${tx.date}</small>
                </div>
                <span class="badge ${tx.status}">${statusText}</span>
            </li>
        `;

        // 如果是待審核，渲染至家長頂部的審核控制台
        if (tx.status === 'pending') {
            hasPending = true;
            pendingListEl.innerHTML += `
                <li class="log-item">
                    <div>
                        <strong>${tx.childName} 申請：</strong>[${tx.category}] $${tx.amount}
                        <small>備註: ${tx.note} (${tx.date})</small>
                    </div>
                    <div>
                        <button class="btn-approve" onclick="reviewAction('${id}', 'approved')">核准</button>
                        <button class="btn-reject" onclick="reviewAction('${id}', 'rejected', ${tx.amount})">駁回</button>
                    </div>
                </li>
            `;
        }
    });

    if (!hasPending) {
        pendingListEl.innerHTML = '<li class="log-item" style="color: #94a3b8;">🎉 目前沒有等待審核的帳目。</li>';
    }
});

// 5. 動作：家長遠端審核處理
window.reviewAction = async function(txId, status, amount = 0) {
    try {
        // 修改該筆帳目的狀態
        const txDocRef = doc(db, "transactions", txId);
        await updateDoc(txDocRef, { status: status });

        // 如果家長選擇「駁回」，則需要把原本已經扣掉的零用錢加回去給小孩
        if (status === 'rejected') {
            const accountDocRef = doc(db, "accounts", user.familyId);
            const docSnap = await getDoc(accountDocRef);
            if (docSnap.exists()) {
                const currentBalance = docSnap.data().balance;
                await updateDoc(accountDocRef, {
                    balance: currentBalance + amount
                });
            }
        }
    } catch (e) {
        console.error("審核失敗:", e);
    }
}

// 6. 動作：家長調整零用錢與門檻
document.getElementById('saveSettingsBtn').addEventListener('click', async function() {
    const newBalance = parseInt(document.getElementById('setBalanceInput').value);
    const newThreshold = parseInt(document.getElementById('setThresholdInput').value);

    try {
        const accountDocRef = doc(db, "accounts", user.familyId);
        await updateDoc(accountDocRef, {
            balance: newBalance,
            threshold: newThreshold
        });
        alert('雲端設定已成功同步更新！');
    } catch (e) {
        console.error(e);
        alert('設定失敗。');
    }
});
