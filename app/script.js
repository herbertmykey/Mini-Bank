(function(){
    // Config
    const TIERS = {
        1: {amount: 10000, rate: 0.05},
        2: {amount: 20000, rate: 0.10},
        3: {amount: 30000, rate: 0.20}
    };
    const STORAGE_KEY = 'savingsGroupStudentsV1';

    // State
    let selectedTier = null;
    let students = loadStudents();

    // DOM
    const tierEls = document.querySelectorAll('.tier');
    const amountEl = document.getElementById('amount');
    const nameEl = document.getElementById('name');
    const previewInterestEl = document.getElementById('previewInterest');
    const previewPayoutEl = document.getElementById('previewPayout');
    const addBtn = document.getElementById('addBtn');
    const clearBtn = document.getElementById('clearBtn');
    const membersTable = document.getElementById('membersTable');
    const totalSavedEl = document.getElementById('totalSaved');
    const memberCountEl = document.getElementById('memberCount');
    const weeklyBtn = document.getElementById('weeklyBtn');
    const messageArea = document.getElementById('messageArea');
    const resetBtn = document.getElementById('resetBtn');

    // Helpers
    function formatNGN(v){
        return '₦' + Number(v).toLocaleString('en-NG', {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    function round(v){
        return Math.round((v + Number.EPSILON) * 100) / 100;
    }
    function escapeHtml(s){
        return String(s).replace(/[&<>"']/g, function(m){
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
        });
    }
    function showMessage(msg, type){
        messageArea.innerHTML = `<div class="notice ${type === 'error'? 'error' : 'ok'}">${escapeHtml(msg)}</div>`;
        setTimeout(()=> { if(messageArea.firstChild) messageArea.removeChild(messageArea.firstChild); }, 4500);
    }
    function clearMessage(){ messageArea.innerHTML = ''; }

    // Storage
    function saveStudents(){
        try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(students)); }catch(e){}
    }
    function loadStudents(){
        try{
            const raw = localStorage.getItem(STORAGE_KEY);
            if(!raw) return [];
            return JSON.parse(raw).map(s=>{
                s.amount = Number(s.amount);
                s.rate = Number(s.rate);
                return s;
            });
        }catch(e){ return []; }
    }

    // UI update / rendering
    function updatePreview(){
        const amt = parseFloat(amountEl.value) || 0;
        const rate = selectedTier ? TIERS[selectedTier].rate : 0;
        const interest = round(amt * rate);
        const payout = round(amt + interest);
        previewInterestEl.textContent = formatNGN(interest);
        previewPayoutEl.textContent = formatNGN(payout);
    }

    function renderTable(){
        membersTable.innerHTML = '';
        if(students.length === 0){
            membersTable.innerHTML = '<tr><td colspan="6" class="muted">No members yet</td></tr>';
            return;
        }
        students.forEach(s=>{
            const weeklyInterest = round(s.amount * s.rate);
            const payout = round(s.amount + weeklyInterest);
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td><strong>${escapeHtml(s.name)}</strong><div class="small muted">Joined: ${new Date(s.joinedAt).toLocaleDateString()}</div></td>
                <td>Tier ${s.tier}</td>
                <td>${formatNGN(s.amount)}</td>
                <td>${formatNGN(weeklyInterest)}</td>
                <td>${formatNGN(payout)}</td>
                <td class="actions">
                    <button class="btn-withdraw" data-id="${s.id}">Withdraw</button>
                </td>
            `;
            membersTable.appendChild(tr);
        });

        // attach withdraw handlers
        membersTable.querySelectorAll('.btn-withdraw').forEach(btn=>{
            btn.addEventListener('click', ()=> {
                const id = btn.dataset.id;
                withdrawStudent(id);
            });
        });
    }

    function renderTotals(){
        const total = students.reduce((sum,s)=> sum + s.amount, 0);
        totalSavedEl.textContent = formatNGN(total);
        memberCountEl.textContent = students.length;
    }

    function renderAll(){
        renderTable();
        renderTotals();
        updatePreview();
    }

    // Events & actions
    function attachTierEvents(){
        tierEls.forEach(el=>{
            el.addEventListener('click', ()=> selectTier(Number(el.dataset.tier)));
            el.addEventListener('keydown', (e)=> { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTier(Number(el.dataset.tier)); } });
        });
    }

    function attachFormEvents(){
        amountEl.addEventListener('input', updatePreview);
        nameEl.addEventListener('input', ()=> clearMessage());
        addBtn.addEventListener('click', handleAddStudent);
        clearBtn.addEventListener('click', clearForm);
        weeklyBtn.addEventListener('click', applyWeeklyProgress);
        resetBtn.addEventListener('click', resetAll);
    }

    function selectTier(t){
        selectedTier = t;
        tierEls.forEach(el=> el.classList.toggle('active', Number(el.dataset.tier) === t));
        amountEl.value = TIERS[t].amount.toFixed(2);
        amountEl.readOnly = true;
        updatePreview();
    }

    function handleAddStudent(){
        clearMessage();
        const name = nameEl.value.trim();
        if(!name){ showMessage('Name cannot be empty', 'error'); return; }
        if(!selectedTier){ showMessage('Please select a tier', 'error'); return; }
        const amt = Number(amountEl.value);
        const expected = TIERS[selectedTier].amount;
        if(Math.abs(amt - expected) > 0.001){
            showMessage(`Amount must match Tier ${selectedTier}: ₦${expected.toLocaleString()}`, 'error');
            return;
        }
        const student = {
            id: Date.now() + Math.random().toString(36).slice(2,6),
            name,
            tier: selectedTier,
            amount: round(amt),
            rate: TIERS[selectedTier].rate,
            joinedAt: new Date().toISOString()
        };
        students.push(student);
        saveStudents();
        renderAll();
        showMessage('Student registered successfully', 'ok');
        clearForm(true);
    }

    function applyWeeklyProgress(){
        if(students.length === 0){ showMessage('No members to apply progress to', 'error'); return; }
        students = students.map(s=>{
            const interest = round(s.amount * s.rate);
            s.amount = round(s.amount + interest);
            return s;
        });
        saveStudents();
        renderAll();
        showMessage('Weekly interest applied to all members', 'ok');
    }

    function withdrawStudent(id){
        const idx = students.findIndex(s=> s.id === id);
        if(idx === -1) return;
        const s = students[idx];
        if(!confirm(`Confirm withdrawal for ${s.name} (current balance ${formatNGN(s.amount)})?`)) return;
        students.splice(idx,1);
        saveStudents();
        renderAll();
        showMessage(`${s.name} has withdrawn and been removed`, 'ok');
    }

    function clearForm(skipMessage){
        nameEl.value = '';
        if(!selectedTier) selectTier(1);
        updatePreview();
        if(!skipMessage) clearMessage();
    }

    function resetAll(){
        if(!confirm('Reset will remove all members. Continue?')) return;
        students = [];
        saveStudents();
        renderAll();
        showMessage('All data reset', 'ok');
    }

    // Init
    function init(){
        selectTier(1);
        attachTierEvents();
        attachFormEvents();
        renderAll();
    }

    // start
    init();
})();
