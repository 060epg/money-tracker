document.getElementById('loginBtn').addEventListener('click', function() {
    const familyId = document.getElementById('familyId').value.trim().toLowerCase();
    const username = document.getElementById('username').value.trim();
    const role = document.getElementById('role').value;

    if (!familyId || !username) {
        alert('請填寫完整登入資訊！');
        return;
    }

    // 將登入資訊暫存至瀏覽器的 localStorage 中，供其他頁面讀取身分
    const userSession = { familyId, username, role };
    localStorage.setItem('family_session', JSON.stringify(userSession));

    // 根據選擇的角色，跳轉到完全獨立的 HTML 頁面
    if (role === 'child') {
        window.location.href = 'child.html';
    } else {
        window.location.href = 'parent.html';
    }
});
