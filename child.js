import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// 1. 安全檢查：驗證身分，防範繞過
const sessionData = localStorage.getItem('family_session');
if (!sessionData) {
    alert('未登入，請先登入！');
    window.location.href = 'login.html';
}

const user = JSON.parse(sessionData);
if (user.role !== 'child') {
    alert('身分不符，請重新登入！');
    window.location.href = 'login.html';
}

// 2. 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 顯示資訊
document.getElementById('welcomeText').innerText = `你好，${user.username} 👋`;
document.getElementById('familyInfo').innerText = `家庭同步代號：${user.familyId} (小孩端)`;

// 全域登出函式掛載至 window
window.logout = function() {
    localStorage.removeItem('family_session');
    window.location.href = 'login.html';
}

// 3. 雲端即時監聽：錢包餘額
onSnapshot(doc(db, "accounts", user.familyId), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('balanceAmount').innerText = data.balance;
        
        // 餘額警戒門檻判斷
        const alertBanner = document.getElementById('lowBalanceAlert');
        if (data.balance <= data.threshold) {
            alertBanner.classList.remove('hidden');
        } else {
            alertBanner.classList.add('hidden');
        }
    }
});

// 4. 雲端即時監聽：記帳歷史紀錄明細
const q = query(
    collection(db, "transactions"),
    where("familyId", "==", user.familyId),
    orderBy("timestamp", "desc")
);

onSnapshot(q, (querySnapshot) => {
    const listEl = document.getElementById('childLogList');
    listEl.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
        const tx = doc.data();
        let statusText = tx.status === 'pending' ? '待審核' : (tx.status === 'approved' ? '已通過' : '被駁回');
        
        listEl.innerHTML += `
            <li class="log-item">
                <div>
                    <strong>[${tx.category}]</strong> $${tx.amount} - ${tx.note}
                    <small>日期: ${tx.date}</small>
                </div>
                <span class="badge ${tx.status}">${statusText}</span>
            </li>
        `;
    });
});

// 5. 動作：小孩提交記帳花費
document.getElementById('transactionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const amount = parseInt(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const note = document.getElementById('note').value;
    const today = new Date().toISOString().split('T')[0];

    try {
        // 動作 A: 將這筆帳目以 "pending" (待審核) 狀態寫入雲端
        await addDoc(collection(db, "transactions"), {
            familyId: user.familyId,
            childName: user.username,
            amount: amount,
            category: category,
            note: note,
            date: today,
            status: 'pending',
            timestamp: Date.now()
        });

        // 動作 B: 即時扣除雲端錢包餘額 (若遭家長駁回，家長端會返還金額)
        const accountDocRef = doc(db, "accounts", user.familyId);
        const docSnap = await getDoc(accountDocRef);
        if (docSnap.exists()) {
            const currentBalance = docSnap.data().balance;
            await updateDoc(accountDocRef, {
                balance: currentBalance - amount
            });
        }

        document.getElementById('transactionForm').reset();
        alert('記帳成功！已同步至雲端，等待家長審核。');
    } catch (error) {
        console.error(error);
        alert('雲端連線失敗，請檢查金鑰設定！');
    }
});
