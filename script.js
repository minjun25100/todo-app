// Firebase 인증 및 사용자 관리
let currentUser = null;
let isOnlineMode = false;

// 전역 변수
let currentTab = 0;
let taskData = {};
let tabNames = ['유튜브 할일', '상품등록', '상품수정', '마케팅', '기타'];
let columnNamesByTab = {}; // 탭별로 컬럼 이름 관리
let columnWidthsByTab = {}; // 탭별로 컬럼 너비 관리
let nextTabId = 5;

// 실행 취소를 위한 히스토리
let undoHistory = [];
const MAX_UNDO_HISTORY = 10;

// 로컬 스토리지에서 데이터 로드
function loadData() {
    const saved = localStorage.getItem('todoAppData');
    if (saved) {
        taskData = JSON.parse(saved);
    } else {
        // 기본 탭 데이터 초기화
        for (let i = 0; i < tabNames.length; i++) {
            taskData[i] = [];
        }
    }
    
    // 탭 이름 로드
    const savedTabNames = localStorage.getItem('todoAppTabNames');
    if (savedTabNames) {
        tabNames = JSON.parse(savedTabNames);
    }
    
    // 탭별 컬럼 이름 로드
    const savedColumnNamesByTab = localStorage.getItem('todoAppColumnNamesByTab');
    if (savedColumnNamesByTab) {
        columnNamesByTab = JSON.parse(savedColumnNamesByTab);
    } else {
        // 기본 컬럼 이름 초기화
        for (let i = 0; i < tabNames.length; i++) {
            columnNamesByTab[i] = {
                rowNumber: '순서',
                title: '할일',
                memo1: '메모 1',
                memo2: '메모 2',
                memo3: '메모 3'
            };
        }
    }
    
    // 탭별 컬럼 너비 로드
    const savedColumnWidthsByTab = localStorage.getItem('todoAppColumnWidthsByTab');
    if (savedColumnWidthsByTab) {
        columnWidthsByTab = JSON.parse(savedColumnWidthsByTab);
    } else {
        // 기본 컬럼 너비 초기화 (백분율로)
        for (let i = 0; i < tabNames.length; i++) {
            columnWidthsByTab[i] = {
                rowNumber: '40px',
                title: '35%',
                memo1: '20%',
                memo2: '20%',
                memo3: '20%',
                completed: '50px'
            };
        }
    }
    
    // nextTabId 로드
    const savedNextTabId = localStorage.getItem('todoAppNextTabId');
    if (savedNextTabId) {
        nextTabId = parseInt(savedNextTabId);
    }
}

// 히스토리에 현재 상태 저장
function saveToHistory() {
    const currentState = JSON.parse(JSON.stringify(taskData));
    undoHistory.push(currentState);
    
    // 히스토리 크기 제한
    if (undoHistory.length > MAX_UNDO_HISTORY) {
        undoHistory.shift();
    }
}

// 실행 취소
function undo() {
    if (undoHistory.length > 0) {
        taskData = undoHistory.pop();
        renderAllTables();
        saveData();
    }
}

// 링크 클릭 처리
function handleLinkClick(event) {
    const textarea = event.target;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;
    
    // 클릭한 위치의 텍스트에서 URL을 찾기
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
        const startPos = match.index;
        const endPos = match.index + match[0].length;
        
        // 클릭한 위치가 URL 범위 내에 있는지 확인
        if (cursorPosition >= startPos && cursorPosition <= endPos) {
            // Ctrl+클릭 또는 더블클릭 시 링크 열기
            if (event.ctrlKey || event.detail === 2) {
                event.preventDefault();
                window.open(match[0], '_blank');
                return;
            }
        }
    }
}

// 로컬 스토리지에 데이터 저장
function saveData() {
    localStorage.setItem('todoAppData', JSON.stringify(taskData));
    localStorage.setItem('todoAppTabNames', JSON.stringify(tabNames));
    localStorage.setItem('todoAppColumnNamesByTab', JSON.stringify(columnNamesByTab));
    localStorage.setItem('todoAppColumnWidthsByTab', JSON.stringify(columnWidthsByTab));
    localStorage.setItem('todoAppNextTabId', nextTabId.toString());
    
    // 온라인 모드일 때 Firebase에도 저장
    if (isOnlineMode && currentUser) {
        saveUserDataToFirebase();
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // Firebase 로드 대기
    setTimeout(() => {
        if (window.firebaseAuth) {
            setupFirebaseAuth();
        } else {
            console.log('Firebase 로드 대기 중...');
            setTimeout(setupFirebaseAuth, 1000);
        }
    }, 500);
});

function setupFirebaseAuth() {
    console.log('🔧 Firebase 인증 설정 시작');
    console.log('Firebase Auth:', window.firebaseAuth);
    console.log('Firebase Provider:', window.firebaseProvider);
    
    const loginBtn = document.getElementById('loginBtn');
    const offlineBtn = document.getElementById('offlineBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    console.log('로그인 버튼:', loginBtn);
    console.log('오프라인 버튼:', offlineBtn);
    
    // 로그인 버튼 클릭
    loginBtn?.addEventListener('click', async () => {
        try {
            // 팝업 방식 먼저 시도
            const result = await window.firebaseSignInWithPopup(window.firebaseAuth, window.firebaseProvider);
            currentUser = result.user;
            isOnlineMode = true;
            showUserSection();
            showMainApp();
            await loadUserDataFromFirebase();
            console.log('✅ 로그인 성공:', currentUser.displayName);
        } catch (error) {
            console.error('❌ 팝업 로그인 실패:', error);
            
            // 팝업이 실패하면 리다이렉트 방식 시도
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                try {
                    console.log('🔄 리다이렉트 방식으로 재시도...');
                    await window.firebaseSignInWithRedirect(window.firebaseAuth, window.firebaseProvider);
                } catch (redirectError) {
                    console.error('❌ 리다이렉트 로그인도 실패:', redirectError);
                    alert('로그인에 실패했습니다. 브라우저 설정을 확인해주세요.');
                }
            } else {
                alert(`로그인 실패: ${error.message}`);
            }
        }
    });
    
    // 오프라인 모드 버튼 클릭
    offlineBtn?.addEventListener('click', () => {
        isOnlineMode = false;
        showMainApp();
        loadData(); // 기존 로컬 데이터 로드
        setupKeyboardShortcuts(); // 키보드 단축키 설정
        setupColumnResizers(); // 컬럼 리사이저 설정
        console.log('📱 오프라인 모드로 시작');
    });
    
    // 로그아웃 버튼 클릭
    logoutBtn?.addEventListener('click', async () => {
        try {
            await window.firebaseSignOut(window.firebaseAuth);
            currentUser = null;
            isOnlineMode = false;
            showLoginSection();
            hideMainApp();
            console.log('✅ 로그아웃 완료');
        } catch (error) {
            console.error('❌ 로그아웃 실패:', error);
        }
    });
    
    // 리다이렉트 결과 확인
    window.firebaseGetRedirectResult(window.firebaseAuth).then((result) => {
        if (result.user) {
            currentUser = result.user;
            isOnlineMode = true;
            showUserSection();
            showMainApp();
            loadUserDataFromFirebase();
            console.log('✅ 리다이렉트 로그인 성공:', currentUser.displayName);
        }
    }).catch((error) => {
        console.error('❌ 리다이렉트 결과 처리 실패:', error);
    });
    
    // 인증 상태 변화 감지 (자동 로그인 포함)
    window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
        if (user && !currentUser) {
            currentUser = user;
            isOnlineMode = true;
            showUserSection();
            showMainApp();
            loadUserDataFromFirebase();
            console.log('🔄 자동 로그인 성공:', user.displayName || user.email);
        } else if (!user) {
            // 로그아웃 상태
            currentUser = null;
            isOnlineMode = false;
            showLoginSection();
            hideMainApp();
        }
    });
}

function showUserSection() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    const userPhoto = document.getElementById('userPhoto');
    const userName = document.getElementById('userName');
    
    if (currentUser) {
        loginSection.style.display = 'none';
        userSection.style.display = 'block';
        userPhoto.src = currentUser.photoURL || '';
        userName.textContent = currentUser.displayName || currentUser.email;
    }
}

function showLoginSection() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    
    loginSection.style.display = 'block';
    userSection.style.display = 'none';
}

function showMainApp() {
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
}

function hideMainApp() {
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    
    authContainer.style.display = 'block';
    appContainer.style.display = 'none';
}

// Firebase에서 사용자 데이터 로드
async function loadUserDataFromFirebase() {
    if (!currentUser || !window.firebaseDB) return;
    
    try {
        const userRef = window.firebaseRef(window.firebaseDB, `users/${currentUser.uid}`);
        const snapshot = await window.firebaseGet(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            
            // 기존 변수들에 데이터 할당
            taskData = userData.taskData || {};
            tabNames = userData.tabNames || ['새 탭 1'];
            columnNamesByTab = userData.columnNamesByTab || {};
            columnWidthsByTab = userData.columnWidthsByTab || {};
            currentTab = userData.currentTab || 0;
            nextTabId = userData.nextTabId || 1;
            
            // UI 업데이트
    renderTabs();
    renderAllTables();
            setupKeyboardShortcuts(); // 키보드 단축키 설정
            setupColumnResizers(); // 컬럼 리사이저 설정
            
            console.log('✅ Firebase에서 데이터 로드 완료');
        } else {
            console.log('📝 새 사용자 - 기존 로컬 데이터 확인 중...');
            // 기존 로컬 데이터 복구 시도
            const hasOldData = localStorage.getItem('todoAppData') || 
                              localStorage.getItem('todoData') || 
                              localStorage.getItem('todoAppTabNames');
            
            if (hasOldData) {
                console.log('🔄 기존 로컬 데이터를 Firebase로 마이그레이션');
                loadData(); // 기존 로컬 데이터 로드
                await saveUserDataToFirebase(); // Firebase에 저장
                                 renderTabs();
                 renderAllTables();
                 setupKeyboardShortcuts();
                 setupColumnResizers();
             } else {
                 console.log('📝 완전히 새로운 사용자 - 기본 데이터로 시작');
                 // 기본 탭 설정
                 if (!taskData[0]) taskData[0] = {};
                 if (!tabNames[0]) tabNames[0] = '새 탭 1';
                 renderTabs();
                 renderAllTables();
                 setupKeyboardShortcuts();
                 setupColumnResizers();
             }
        }
    } catch (error) {
        console.error('❌ Firebase 데이터 로드 실패:', error);
        loadData(); // 로컬 데이터로 폴백
    }
}

// Firebase에 사용자 데이터 저장
async function saveUserDataToFirebase() {
    if (!currentUser || !window.firebaseDB || !isOnlineMode) return;
    
    try {
        const userData = {
            taskData: taskData || {},
            tabNames: tabNames || ['새 탭 1'],
            columnNamesByTab: columnNamesByTab || {},
            columnWidthsByTab: columnWidthsByTab || {},
            currentTab: currentTab || 0,
            nextTabId: nextTabId || 1,
            lastUpdated: new Date().toISOString()
        };
        
        const userRef = window.firebaseRef(window.firebaseDB, `users/${currentUser.uid}`);
        await window.firebaseSet(userRef, userData);
        
        console.log('✅ Firebase에 데이터 저장 완료');
    } catch (error) {
        console.error('❌ Firebase 데이터 저장 실패:', error);
    }
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Ctrl+Z: 실행 취소
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            undo();
        }
        
        // Ctrl+1~9: 탭 전환
        if (event.ctrlKey && event.key >= '1' && event.key <= '9') {
            event.preventDefault();
            const tabIndex = parseInt(event.key) - 1;
            if (tabIndex < tabNames.length) {
                switchTab(tabIndex);
            }
        }
    });
}

// 탭 렌더링
function renderTabs() {
    const tabButtonsContainer = document.querySelector('.tab-buttons');
    const tabContentsContainer = document.getElementById('tabContents');
    
    // 기존 탭 버튼들 제거 (+ 탭 추가 버튼 제외)
    const existingTabButtons = tabButtonsContainer.querySelectorAll('.tab-button');
    existingTabButtons.forEach(btn => btn.remove());
    
    // 기존 탭 내용들 제거
    tabContentsContainer.innerHTML = '';
    
    // 탭 버튼들 생성
    tabNames.forEach((name, index) => {
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-button';
        if (index === currentTab) {
            tabButton.classList.add('active');
        }
        tabButton.setAttribute('data-tab', index);
        tabButton.textContent = name;
        tabButton.onclick = () => switchTab(index);
        
        // + 탭 추가 버튼 앞에 삽입
        const addTabBtn = tabButtonsContainer.querySelector('.add-tab-btn');
        tabButtonsContainer.insertBefore(tabButton, addTabBtn);
    });
    
    // 탭 내용들 생성
    tabNames.forEach((name, index) => {
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        if (index === currentTab) {
            tabContent.classList.add('active');
        }
        tabContent.setAttribute('data-tab', index);
        
        tabContent.innerHTML = `
            <div class="tab-header">
                <input type="text" class="tab-name-input" value="${name}" 
                       onchange="updateTabName(${index}, this.value)" />
                <div class="tab-actions">
                    <button class="add-task-btn" onclick="addTask(${index})">+ 할일 추가</button>
                    ${tabNames.length > 1 ? `<button class="delete-tab-btn" onclick="deleteTab(${index})">× 탭 삭제</button>` : ''}
                </div>
            </div>
            <div class="table-container">
                <table class="excel-table" id="excelTable${index}">
                    <thead>
                        <tr>
                            <th style="width: ${getColumnWidth(index, 'rowNumber')}" class="center-header"><input type="text" class="header-input center-input" value="${getColumnName(index, 'rowNumber')}" onchange="updateColumnName(${index}, 'rowNumber', this.value)"><div class="column-resizer" data-tab="${index}" data-column="rowNumber"></div></th>
                            <th style="width: ${getColumnWidth(index, 'title')}" class="center-header"><input type="text" class="header-input center-input" value="${getColumnName(index, 'title')}" onchange="updateColumnName(${index}, 'title', this.value)"><div class="column-resizer" data-tab="${index}" data-column="title"></div></th>
                            <th style="width: ${getColumnWidth(index, 'memo1')}" class="center-header"><input type="text" class="header-input center-input" value="${getColumnName(index, 'memo1')}" onchange="updateColumnName(${index}, 'memo1', this.value)"><div class="column-resizer" data-tab="${index}" data-column="memo1"></div></th>
                            <th style="width: ${getColumnWidth(index, 'memo2')}" class="center-header"><input type="text" class="header-input center-input" value="${getColumnName(index, 'memo2')}" onchange="updateColumnName(${index}, 'memo2', this.value)"><div class="column-resizer" data-tab="${index}" data-column="memo2"></div></th>
                            <th style="width: ${getColumnWidth(index, 'memo3')}" class="center-header"><input type="text" class="header-input center-input" value="${getColumnName(index, 'memo3')}" onchange="updateColumnName(${index}, 'memo3', this.value)"><div class="column-resizer" data-tab="${index}" data-column="memo3"></div></th>
                            <th style="width: ${getColumnWidth(index, 'completed')}" class="center-header">완료</th>
                        </tr>
                    </thead>
                    <tbody id="tableBody${index}">
                        <!-- 할일 행들이 여기에 추가됩니다 -->
                    </tbody>
                </table>
            </div>
        `;
        
        tabContentsContainer.appendChild(tabContent);
    });
    
    // 렌더링 후 모든 테이블 다시 렌더링 (데이터 보존)
    renderAllTables();
    
    // 컬럼 리사이저 설정
    setupColumnResizers();
    
    // 탭 드래그 앤 드롭 설정
    setupTabDragAndDrop();
}

// 탭 전환
function switchTab(tabIndex) {
    currentTab = tabIndex;
    
    // 기존 활성 탭/콘텐츠 비활성화
    document.querySelectorAll('.tab-button.active').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content.active').forEach(content => {
        content.classList.remove('active');
    });
    
    // 새 탭/콘텐츠 활성화
    const newTabButton = document.querySelector(`[data-tab="${tabIndex}"].tab-button`);
    const newTabContent = document.querySelector(`[data-tab="${tabIndex}"].tab-content`);
    
    if (newTabButton) newTabButton.classList.add('active');
    if (newTabContent) newTabContent.classList.add('active');
}

// 새 탭 추가
function addNewTab() {
    const newTabName = `새 탭 ${nextTabId}`;
    const newTabIndex = tabNames.length;
    
    // 히스토리 저장
    saveToHistory();
    
    // 탭 이름과 데이터 추가
    tabNames.push(newTabName);
    taskData[newTabIndex] = [];
    
    // 새 탭의 기본 컬럼 이름 설정
    columnNamesByTab[newTabIndex] = {
        rowNumber: '순서',
        title: '할일',
        memo1: '메모 1',
        memo2: '메모 2',
        memo3: '메모 3'
    };
    
    // 새 탭의 기본 컬럼 너비 설정
    columnWidthsByTab[newTabIndex] = {
        rowNumber: '60px',
        title: '400px',
        memo1: '250px',
        memo2: '250px',
        memo3: '250px',
        completed: '80px'
    };
    
    nextTabId++;
    currentTab = newTabIndex;
    
    // 탭 렌더링 후 새 탭으로 전환
    renderTabs();
    switchTab(newTabIndex);
    
    // 데이터 저장
    saveData();
}

// 탭 삭제
function deleteTab(tabIndex) {
    if (tabNames.length <= 1) {
        alert('최소 하나의 탭은 있어야 합니다.');
        return;
    }
    
    if (confirm(`"${tabNames[tabIndex]}" 탭을 삭제하시겠습니까? 모든 할일이 삭제됩니다.`)) {
        saveToHistory();
        
        // 기존 데이터를 순서대로 배열에 저장
        const orderedData = [];
        for (let i = 0; i < tabNames.length; i++) {
            orderedData[i] = taskData[i] || [];
        }
        
        // 삭제할 탭의 데이터와 이름 제거
        tabNames.splice(tabIndex, 1);
        orderedData.splice(tabIndex, 1);
        
        // 새로운 taskData 객체 생성
        taskData = {};
        for (let i = 0; i < tabNames.length; i++) {
            taskData[i] = orderedData[i];
        }
        
        // 컬럼 이름도 재정렬
        const newColumnNamesByTab = {};
        let sourceIndex = 0;
        for (let i = 0; i < tabNames.length; i++) {
            if (sourceIndex === tabIndex) sourceIndex++; // 삭제된 탭 건너뛰기
            newColumnNamesByTab[i] = columnNamesByTab[sourceIndex] || {
                memo1: '메모 1',
                memo2: '메모 2',
                memo3: '메모 3'
            };
            sourceIndex++;
        }
        columnNamesByTab = newColumnNamesByTab;
        
        // 현재 탭 조정
        if (currentTab >= tabNames.length) {
            currentTab = tabNames.length - 1;
        } else if (currentTab > tabIndex) {
            currentTab = currentTab - 1;
        }
        
        renderTabs();
        renderAllTables(); // 탭 삭제 후 모든 테이블 다시 렌더링
        saveData();
    }
}

// 탭 이름 업데이트
function updateTabName(tabIndex, newName) {
    tabNames[tabIndex] = newName;
    document.querySelector(`[data-tab="${tabIndex}"].tab-button`).textContent = newName;
    saveData();
}

// 컬럼 이름 가져오기
function getColumnName(tabIndex, columnKey) {
    if (!columnNamesByTab[tabIndex]) {
        columnNamesByTab[tabIndex] = {
            memo1: '메모 1',
            memo2: '메모 2',
            memo3: '메모 3'
        };
    }
    return columnNamesByTab[tabIndex][columnKey];
}

// 컬럼 너비 가져오기
function getColumnWidth(tabIndex, columnKey) {
    if (!columnWidthsByTab[tabIndex]) {
        columnWidthsByTab[tabIndex] = {
            rowNumber: '60px',
            title: '400px',
            memo1: '250px',
            memo2: '250px',
            memo3: '250px',
            completed: '80px'
        };
    }
    return columnWidthsByTab[tabIndex][columnKey];
}

// 컬럼 이름 업데이트 (탭별로)
function updateColumnName(tabIndex, columnKey, newName) {
    if (!columnNamesByTab[tabIndex]) {
        columnNamesByTab[tabIndex] = {
            memo1: '메모 1',
            memo2: '메모 2',
            memo3: '메모 3'
        };
    }
    
    columnNamesByTab[tabIndex][columnKey] = newName;
    
    // 해당 탭의 플레이스홀더만 업데이트
    const currentTabContent = document.querySelector(`[data-tab="${tabIndex}"].tab-content`);
    if (currentTabContent) {
        const inputs = currentTabContent.querySelectorAll(`[data-field="${columnKey}"]`);
        inputs.forEach(input => {
            input.placeholder = newName;
        });
    }
    
    saveData();
}

// 할일 추가
function addTask(tabIndex) {
    saveToHistory();
    
    // taskData[tabIndex] 초기화 확인
    if (!taskData[tabIndex]) {
        taskData[tabIndex] = [];
    }
    
    const taskId = Date.now();
    const newTask = {
        id: taskId,
        title: '',
        memo1: '',
        memo2: '',
        memo3: '',
        completed: false
    };
    
    taskData[tabIndex].push(newTask);
    renderTable(tabIndex);
    saveData();
    
    // 새로 추가된 할일의 제목 셀에 포커스
    setTimeout(() => {
        const tableBody = document.getElementById(`tableBody${tabIndex}`);
        if (tableBody && tableBody.lastElementChild) {
            const titleInput = tableBody.lastElementChild.querySelector('.title-input');
            if (titleInput) {
                titleInput.focus();
            }
        }
    }, 100);
}

// 할일 삭제 (체크박스 클릭 시)
function deleteTask(tabIndex, taskId) {
    saveToHistory();
    
    const taskRow = document.querySelector(`tr[data-task-id="${taskId}"]`);
    
    // 애니메이션 추가
    if (taskRow) {
        taskRow.style.transition = 'opacity 0.5s ease';
        taskRow.style.opacity = '0';
    
    // 애니메이션 완료 후 삭제
    setTimeout(() => {
        taskData[tabIndex] = taskData[tabIndex].filter(task => task.id !== taskId);
            renderTable(tabIndex);
        saveData();
    }, 500);
    }
}

// 특정 탭의 테이블 렌더링
function renderTable(tabIndex) {
    const tableBody = document.getElementById(`tableBody${tabIndex}`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // taskData[tabIndex] 초기화 확인
    if (!taskData[tabIndex]) {
        taskData[tabIndex] = [];
    }
    
    if (taskData[tabIndex] && taskData[tabIndex].length > 0) {
        taskData[tabIndex].forEach((task, index) => {
            const row = createTaskRow(task, tabIndex, index + 1);
            tableBody.appendChild(row);
        });
    }
    
    // 새 행 추가 버튼 행
    const addRow = document.createElement('tr');
    addRow.innerHTML = `
        <td colspan="6">
            <button class="add-row-btn" onclick="addTask(${tabIndex})">+ 새 할일 추가</button>
        </td>
    `;
    tableBody.appendChild(addRow);
}

// 모든 탭의 테이블 렌더링
function renderAllTables() {
    tabNames.forEach((_, index) => {
        renderTable(index);
    });
}

// 할일 행 생성
function createTaskRow(task, tabIndex, rowNumber) {
    const row = document.createElement('tr');
    row.setAttribute('data-task-id', task.id);
    row.draggable = true;
    
    row.innerHTML = `
        <td class="row-number">${rowNumber}</td>
        <td>
            <textarea class="cell-input title-input" 
                  placeholder="할일을 입력하세요..." 
                  onchange="updateTask(${tabIndex}, ${task.id}, 'title', this.value)"
                      onkeydown="handleCellNavigation(event, ${tabIndex})"
                      data-field="title">${task.title}</textarea>
        </td>
        <td>
            <textarea class="cell-input" 
                      placeholder="" 
                      onchange="updateTask(${tabIndex}, ${task.id}, 'memo1', this.value)"
                      onkeydown="handleCellNavigation(event, ${tabIndex})"
                      onclick="handleLinkClick(event)"
                      data-field="memo1">${task.memo1 || ''}</textarea>
        </td>
        <td>
            <textarea class="cell-input" 
                      placeholder="" 
                      onchange="updateTask(${tabIndex}, ${task.id}, 'memo2', this.value)"
                      onkeydown="handleCellNavigation(event, ${tabIndex})"
                      onclick="handleLinkClick(event)"
                      data-field="memo2">${task.memo2 || ''}</textarea>
        </td>
        <td>
            <textarea class="cell-input" 
                      placeholder="" 
                      onchange="updateTask(${tabIndex}, ${task.id}, 'memo3', this.value)"
                      onkeydown="handleCellNavigation(event, ${tabIndex})"
                      onclick="handleLinkClick(event)"
                      data-field="memo3">${task.memo3 || ''}</textarea>
        </td>
        <td class="checkbox-cell">
            <input type="checkbox" 
                   class="task-checkbox" 
                   ${task.completed ? 'checked' : ''}
                   onchange="toggleTask(${tabIndex}, ${task.id})">
        </td>
    `;
    
    // 드래그 앤 드롭 이벤트 추가
    setupRowDragAndDrop(row, tabIndex);
    
    return row;
}

// 엑셀과 같은 셀 네비게이션 (엔터 = 다음 행, 탭 = 다음 열)
function handleCellNavigation(event, tabIndex) {
    const currentCell = event.target;
    const currentRow = currentCell.closest('tr');
    const currentField = currentCell.getAttribute('data-field');
    
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        
        // 다음 행의 같은 열로 이동
        const nextRow = currentRow.nextElementSibling;
        
        if (nextRow && nextRow.getAttribute('data-task-id')) {
            // 다음 행이 있으면 같은 필드로 이동
            const nextCell = nextRow.querySelector(`[data-field="${currentField}"]`);
            if (nextCell) {
                nextCell.focus();
                // 커서를 텍스트 끝으로 이동하여 바로 입력 가능하게
                setTimeout(() => {
                    const len = nextCell.value.length;
                    nextCell.setSelectionRange(len, len);
                }, 10);
            }
        } else {
            // 다음 행이 없으면 새 할일 추가하고 그 행의 같은 필드로 이동
            addTask(tabIndex);
            setTimeout(() => {
                const tableBody = document.getElementById(`tableBody${tabIndex}`);
                const rows = Array.from(tableBody.children).filter(row => row.getAttribute('data-task-id'));
                const lastRow = rows[rows.length - 1];
                
                if (lastRow) {
                    const nextCell = lastRow.querySelector(`[data-field="${currentField}"]`);
                    if (nextCell) {
                        nextCell.focus();
                        // 새 행이므로 바로 입력 가능하게
                        setTimeout(() => {
                            nextCell.setSelectionRange(0, 0);
                        }, 10);
                    }
                }
            }, 150);
        }
    } 
    else if (event.key === 'Tab') {
        event.preventDefault();
        
        const fields = ['title', 'memo1', 'memo2', 'memo3'];
        const currentIndex = fields.indexOf(currentField);
        
        if (event.shiftKey) {
            // Shift+Tab: 이전 필드로
            if (currentIndex > 0) {
                const prevField = fields[currentIndex - 1];
                const prevCell = currentRow.querySelector(`[data-field="${prevField}"]`);
                if (prevCell) {
                    prevCell.focus();
                    setTimeout(() => {
                        const len = prevCell.value.length;
                        prevCell.setSelectionRange(len, len);
                    }, 10);
                }
            } else {
                // 첫 번째 필드에서 Shift+Tab이면 이전 행의 마지막 필드로
                const prevRow = currentRow.previousElementSibling;
                if (prevRow && prevRow.getAttribute('data-task-id')) {
                    const prevCell = prevRow.querySelector(`[data-field="memo3"]`);
                    if (prevCell) {
                        prevCell.focus();
                        setTimeout(() => {
                            const len = prevCell.value.length;
                            prevCell.setSelectionRange(len, len);
                        }, 10);
                    }
                }
            }
        } else {
            // Tab: 다음 필드로
            if (currentIndex < fields.length - 1) {
                const nextField = fields[currentIndex + 1];
                const nextCell = currentRow.querySelector(`[data-field="${nextField}"]`);
                if (nextCell) {
                    nextCell.focus();
                    setTimeout(() => {
                        const len = nextCell.value.length;
                        nextCell.setSelectionRange(len, len);
                    }, 10);
                }
            } else {
                // 마지막 필드에서 Tab이면 다음 행의 첫 번째 필드로
                const nextRow = currentRow.nextElementSibling;  
                if (nextRow && nextRow.getAttribute('data-task-id')) {
                    const nextCell = nextRow.querySelector(`[data-field="title"]`);
                    if (nextCell) {
                        nextCell.focus();
                        setTimeout(() => {
                            const len = nextCell.value.length;
                            nextCell.setSelectionRange(len, len);
                        }, 10);
                    }
                } else {
                    // 다음 행이 없으면 새 할일 추가
                    addTask(tabIndex);
                }
            }
        }
    }
}

// 할일 정보 업데이트
function updateTask(tabIndex, taskId, field, value) {
    // taskData[tabIndex] 초기화 확인
    if (!taskData[tabIndex]) {
        taskData[tabIndex] = [];
        return;
    }
    
    const task = taskData[tabIndex].find(t => t.id == taskId);
    if (task) {
        task[field] = value;
        saveData();
        console.log(`✅ ${field} 업데이트 완료:`, value);
    } else {
        console.error(`❌ Task not found: tabIndex=${tabIndex}, taskId=${taskId}`);
    }
}

// 할일 완료 토글
function toggleTask(tabIndex, taskId) {
    const task = taskData[tabIndex].find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        
        if (task.completed) {
            // 완료 시 삭제
            deleteTask(tabIndex, taskId);
        } else {
            saveData();
        }
    }
}

// 행 드래그 앤 드롭 설정
function setupRowDragAndDrop(row, tabIndex) {
    row.addEventListener('dragstart', (e) => {
        row.classList.add('dragging');
        e.dataTransfer.setData('text/plain', row.getAttribute('data-task-id'));
        e.dataTransfer.setData('source-tab', tabIndex);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    row.addEventListener('dragend', (e) => {
        row.classList.remove('dragging');
        hideDragInsertIndicator();
    });
    
    row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!row.classList.contains('dragging')) {
            showDragInsertIndicator(row, e.clientY);
        }
    });
    
    row.addEventListener('dragleave', (e) => {
        if (!row.contains(e.relatedTarget)) {
            hideDragInsertIndicator();
        }
    });
    
    row.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        hideDragInsertIndicator();
        
        const draggedTaskId = e.dataTransfer.getData('text/plain');
        const sourceTabIndex = parseInt(e.dataTransfer.getData('source-tab'));
        const targetTaskId = row.getAttribute('data-task-id');
        
        if (draggedTaskId !== targetTaskId) {
            const rect = row.getBoundingClientRect();
            const mouseY = e.clientY;
            const centerY = rect.top + rect.height / 2;
            const insertAfter = mouseY >= centerY;
            
            moveTask(sourceTabIndex, draggedTaskId, tabIndex, targetTaskId, insertAfter);
        }
    });
}

// 할일 위치 이동
function moveTask(sourceTabIndex, draggedTaskId, targetTabIndex, targetTaskId, insertAfter = false) {
    saveToHistory();
    
    // 드래그된 할일 찾기
    const draggedTaskIndex = taskData[sourceTabIndex].findIndex(task => task.id == draggedTaskId);
    const draggedTask = taskData[sourceTabIndex][draggedTaskIndex];
    
    if (!draggedTask) return;
    
    // 타겟 위치 찾기
    const targetTaskIndex = taskData[targetTabIndex].findIndex(task => task.id == targetTaskId);
    
    // 소스에서 제거
    taskData[sourceTabIndex].splice(draggedTaskIndex, 1);
    
    // 삽입 위치 계산
    let insertIndex;
    if (targetTaskIndex === -1) {
        insertIndex = taskData[targetTabIndex].length;
    } else {
        if (sourceTabIndex === targetTabIndex && draggedTaskIndex < targetTaskIndex) {
            insertIndex = insertAfter ? targetTaskIndex : targetTaskIndex - 1;
        } else {
            insertIndex = insertAfter ? targetTaskIndex + 1 : targetTaskIndex;
        }
    }
    
    // 타겟 탭에 삽입
    taskData[targetTabIndex].splice(insertIndex, 0, draggedTask);
    
    // 렌더링 및 저장
    renderTable(sourceTabIndex);
    if (sourceTabIndex !== targetTabIndex) {
        renderTable(targetTabIndex);
    }
    saveData();
}

// 탭 드래그 앤 드롭 설정
function setupTabDragAndDrop() {
    const tabButtons = document.querySelectorAll('.tab-button:not(.add-tab-btn)');
    
    tabButtons.forEach((tabButton, index) => {
        tabButton.draggable = true;
        
        tabButton.addEventListener('dragstart', (e) => {
            tabButton.classList.add('dragging');
            e.dataTransfer.setData('text/plain', index);
        });
        
        tabButton.addEventListener('dragend', (e) => {
            tabButton.classList.remove('dragging');
            
            document.querySelectorAll('.drag-over-left, .drag-over-right').forEach(el => {
                el.classList.remove('drag-over-left', 'drag-over-right');
            });
        });
        
        tabButton.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!tabButton.classList.contains('dragging')) {
                const rect = tabButton.getBoundingClientRect();
                const mouseX = e.clientX;
                const centerX = rect.left + rect.width / 2;
                
                tabButton.classList.remove('drag-over-left', 'drag-over-right');
                if (mouseX < centerX) {
                    tabButton.classList.add('drag-over-left');
                } else {
                    tabButton.classList.add('drag-over-right');
                }
            }
        });
        
        tabButton.addEventListener('dragleave', (e) => {
            tabButton.classList.remove('drag-over-left', 'drag-over-right');
        });
        
        tabButton.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = index;
            
            tabButton.classList.remove('drag-over-left', 'drag-over-right');
            
            if (draggedIndex !== targetIndex) {
                const rect = tabButton.getBoundingClientRect();
                const mouseX = e.clientX;
                const centerX = rect.left + rect.width / 2;
                const insertPosition = mouseX < centerX ? targetIndex : targetIndex + 1;
                
                moveTab(draggedIndex, insertPosition);
            }
        });
    });
}

// 탭 위치 이동
function moveTab(fromIndex, toIndex) {
    saveToHistory();
    
    if (fromIndex < 0 || fromIndex >= tabNames.length || toIndex < 0 || toIndex > tabNames.length) {
        return;
    }
    
    if (fromIndex === toIndex || fromIndex === toIndex - 1) {
        return;
    }
    
    // 탭 이름 이동
    const movedTabName = tabNames.splice(fromIndex, 1)[0];
    const insertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    tabNames.splice(insertIndex, 0, movedTabName);
    
    // 태스크 데이터 이동
    const movedTaskData = taskData[fromIndex];
    delete taskData[fromIndex];
    
    // 새로운 taskData 객체 생성
    const newTaskData = {};
    let newIndex = 0;
    
    for (let i = 0; i < tabNames.length; i++) {
        if (i === insertIndex) {
            newTaskData[i] = movedTaskData;
        } else {
            const oldIndex = newIndex === fromIndex ? newIndex + 1 : newIndex;
            newTaskData[i] = taskData[oldIndex] || [];
            newIndex = oldIndex + 1;
        }
    }
    
    taskData = newTaskData;
    
    // 현재 탭 인덱스 조정
    if (currentTab === fromIndex) {
        currentTab = insertIndex;
    } else if (currentTab > fromIndex && currentTab <= insertIndex) {
        currentTab--;
    } else if (currentTab < fromIndex && currentTab >= insertIndex) {
        currentTab++;
    }
    
    // 렌더링 및 저장
    renderTabs();
    renderAllTables(); // 탭 이동 후 모든 테이블 다시 렌더링
    saveData();
}

// 키보드 단축키
document.addEventListener('keydown', function(e) {
    // Ctrl+Enter로 새 할일 추가
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        addTask(currentTab);
    }
    
    // Ctrl+Z로 실행 취소
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    
    // 탭 전환 (Ctrl + 숫자)
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabNames.length) {
            switchTab(tabIndex);
        }
    }
});

// 데이터 내보내기/가져오기
function exportData() {
    const dataStr = JSON.stringify({
        tasks: taskData,
        tabNames: tabNames,
        columnNamesByTab: columnNamesByTab
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'todo-backup.json';
    link.click();
    
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.tasks) {
                    taskData = data.tasks;
                    renderAllTables();
                }
                if (data.tabNames) {
                    tabNames = data.tabNames;
                    renderTabs();
                }
                if (data.columnNamesByTab) {
                    columnNamesByTab = data.columnNamesByTab;
                    renderTabs(); // 헤더 업데이트를 위해 다시 렌더링
                } else if (data.columnNames) {
                    // 이전 버전 호환성
                    for (let i = 0; i < tabNames.length; i++) {
                        columnNamesByTab[i] = data.columnNames;
                    }
                    renderTabs();
                }
                saveData();
                alert('데이터를 성공적으로 가져왔습니다!');
            } catch (error) {
                alert('파일 형식이 올바르지 않습니다.');
            }
        };
        reader.readAsText(file);
    }
} 

// 컬럼 리사이저 설정 (엑셀/구글시트 스타일)
function setupColumnResizers() {
    const resizers = document.querySelectorAll('.column-resizer');
    
    resizers.forEach(resizer => {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        let targetColumn = null;
        let tabIndex = null;
        let columnKey = null;
        let table = null;
        
        // 더블클릭으로 자동 크기 조절 (엑셀 스타일로 인접 컬럼도 조정)
        resizer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            tabIndex = parseInt(resizer.getAttribute('data-tab'));
            columnKey = resizer.getAttribute('data-column');
            targetColumn = resizer.closest('th');
            table = targetColumn.closest('table');
            const nextColumn = targetColumn.nextElementSibling;
            
            // 현재 너비들
            const currentWidth = targetColumn.offsetWidth;
            const nextCurrentWidth = nextColumn ? nextColumn.offsetWidth : 0;
            
            // 최적 너비 계산
            const optimalWidth = calculateOptimalColumnWidth(table, targetColumn, columnKey);
            const widthDiff = optimalWidth - currentWidth;
            
            // 애니메이션 효과
            targetColumn.style.transition = 'width 0.15s ease-out';
            if (nextColumn && nextColumn !== table.querySelector('th:last-child')) {
                nextColumn.style.transition = 'width 0.15s ease-out';
            }
            
            // 현재 컬럼 조정
            targetColumn.style.width = optimalWidth + 'px';
            
            // 다음 컬럼이 있고 완료 컬럼이 아니면 반대로 조정
            if (nextColumn && nextColumn !== table.querySelector('th:last-child')) {
                const nextNewWidth = Math.max(50, nextCurrentWidth - widthDiff);
                nextColumn.style.width = nextNewWidth + 'px';
                
                // 다음 컬럼 너비도 저장
                const nextColumnKey = nextColumn.querySelector('.column-resizer')?.getAttribute('data-column');
                if (nextColumnKey && columnWidthsByTab[tabIndex]) {
                    columnWidthsByTab[tabIndex][nextColumnKey] = nextNewWidth + 'px';
                }
            }
            
            // 현재 컬럼 너비 저장
            if (columnWidthsByTab[tabIndex]) {
                columnWidthsByTab[tabIndex][columnKey] = optimalWidth + 'px';
                saveData();
            }
            
            // 애니메이션 후 transition 제거
            setTimeout(() => {
                targetColumn.style.transition = '';
            }, 150);
        });
        
        // 마우스 다운으로 리사이징 시작
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isResizing = true;
            startX = e.clientX;
            tabIndex = parseInt(resizer.getAttribute('data-tab'));
            columnKey = resizer.getAttribute('data-column');
            targetColumn = resizer.closest('th');
            table = targetColumn.closest('table');
            startWidth = targetColumn.offsetWidth;
            
            // 다음 컬럼 찾기 (엑셀 스타일 리사이징을 위해)
            const nextColumn = targetColumn.nextElementSibling;
            const nextStartWidth = nextColumn ? nextColumn.offsetWidth : 0;
            
            // 시각적 피드백
            resizer.classList.add('resizing');
            table.classList.add('table-resizing');
            document.body.classList.add('col-resizing');
            
            // 전역 마우스 이동 이벤트 - 엑셀 스타일 (인접 두 컬럼만 조절)
            const handleMouseMove = (e) => {
                if (!isResizing || !targetColumn) return;
                
                const diffX = e.clientX - startX;
                const newWidth = Math.max(30, startWidth + diffX);
                
                // 현재 컬럼 크기 조절
                targetColumn.style.width = newWidth + 'px';
                
                // 다음 컬럼이 있으면 반대로 조절 (전체 너비 유지)
                if (nextColumn && nextColumn !== table.querySelector('th:last-child')) {
                    const nextNewWidth = Math.max(30, nextStartWidth - diffX);
                    nextColumn.style.width = nextNewWidth + 'px';
                }
                
                e.preventDefault();
            };
            
            // 전역 마우스 업 이벤트
            const handleMouseUp = (e) => {
                if (!isResizing) return;
                
                isResizing = false;
                
                // 시각적 피드백 제거
                resizer.classList.remove('resizing');
                if (table) table.classList.remove('table-resizing');
                document.body.classList.remove('col-resizing');
                
                // 최종 너비 저장
                const finalWidth = targetColumn.offsetWidth;
                if (columnWidthsByTab[tabIndex]) {
                    columnWidthsByTab[tabIndex][columnKey] = finalWidth + 'px';
                    
                    // 다음 컬럼 너비도 저장
                    if (nextColumn && nextColumn !== table.querySelector('th:last-child')) {
                        const nextColumnKey = nextColumn.querySelector('.column-resizer')?.getAttribute('data-column');
                        if (nextColumnKey) {
                            columnWidthsByTab[tabIndex][nextColumnKey] = nextColumn.offsetWidth + 'px';
                        }
                    }
                    
                    saveData();
                }
                
                // 이벤트 리스너 제거
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                
                // 변수 초기화
                targetColumn = null;
                table = null;
            };
            
            // 이벤트 리스너 추가
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // 마우스 오버 시 커서 변경을 위한 추가 이벤트
        resizer.addEventListener('mouseenter', (e) => {
            if (!isResizing) {
                resizer.style.cursor = 'col-resize';
            }
        });
    });
}

// 컬럼의 최적 너비 계산 (더블클릭 시 사용)
function calculateOptimalColumnWidth(table, targetColumn, columnKey) {
    const columnIndex = Array.from(targetColumn.parentNode.children).indexOf(targetColumn);
    let maxWidth = 50; // 기본 최소 너비 더 작게
    
    // 컬럼 키에 따른 특별 처리
    if (columnKey === 'rowNumber') {
        return 60; // 행 번호는 고정 크기
    }
    if (columnKey === 'completed') {
        return 60; // 완료 체크박스는 고정 크기
    }
    
    // 헤더 텍스트 너비 측정 (패딩 최소화)
    const headerContent = targetColumn.querySelector('.header-input') || targetColumn;
    const headerText = headerContent.value || headerContent.textContent || '';
    if (headerText.trim()) {
        const headerWidth = measureTextWidth(headerText.trim(), 'bold 14px system-ui') + 16;
        maxWidth = Math.max(maxWidth, headerWidth);
    }
    
    // 각 행의 해당 컬럼 내용 너비 측정 (패딩 최소화)
    const rows = table.querySelectorAll('tbody tr[data-task-id]');
    
    rows.forEach((row, rowIndex) => {
        if (rowIndex < 15) { // 최대 15개 행만 검사
            const cell = row.children[columnIndex];
            if (cell) {
                const input = cell.querySelector('.cell-input');
                if (input && input.value && input.value.trim()) {
                    const text = input.value.trim();
                    // 실제 텍스트 너비 + 최소한의 패딩만
                    const textWidth = measureTextWidth(text, '14px system-ui') + 12;
                    maxWidth = Math.max(maxWidth, textWidth);
                }
            }
        }
    });
    
    // 컬럼별 최소 너비 (더 작게 설정)
    const minWidths = {
        'title': 80,
        'memo1': 70,
        'memo2': 70,
        'memo3': 70
    };
    
    if (minWidths[columnKey]) {
        maxWidth = Math.max(maxWidth, minWidths[columnKey]);
    }
    
    // 최대 너비 제한
    const maxAllowedWidth = Math.min(window.innerWidth * 0.3, 400);
    return Math.min(maxWidth, maxAllowedWidth);
}

// 텍스트 너비 측정 유틸리티 함수
function measureTextWidth(text, font) {
    // 빈 텍스트는 0 반환
    if (!text || !text.trim()) return 0;
    
    // 캐시된 canvas 재사용
    if (!measureTextWidth.canvas) {
        measureTextWidth.canvas = document.createElement('canvas');
        measureTextWidth.context = measureTextWidth.canvas.getContext('2d');
    }
    
    const context = measureTextWidth.context;
    context.font = font;
    const width = context.measureText(text.trim()).width;
    
    // 정확한 측정 (여유 공간 최소화)
    return Math.ceil(width);
}

// 컬럼 너비 업데이트
function updateColumnWidth(tabIndex, columnKey, width) {
    if (!columnWidthsByTab[tabIndex]) {
        columnWidthsByTab[tabIndex] = {
            rowNumber: '60px',
            title: '400px',
            memo1: '250px',
            memo2: '250px',
            memo3: '250px',
            completed: '80px'
        };
    }
    
    columnWidthsByTab[tabIndex][columnKey] = width;
    
    // 해당 탭의 테이블에 즉시 적용
    const table = document.getElementById(`excelTable${tabIndex}`);
    if (table) {
        const headers = table.querySelectorAll('th');
        const columnIndex = ['rowNumber', 'title', 'memo1', 'memo2', 'memo3', 'completed'].indexOf(columnKey);
        if (columnIndex !== -1 && headers[columnIndex]) {
            headers[columnIndex].style.width = width;
        }
    }
    
    saveData();
}

// 드래그 삽입 위치 표시 관련 함수들
let dragInsertIndicator = null;

function showDragInsertIndicator(targetRow, mouseY) {
    hideDragInsertIndicator(); // 기존 인디케이터 제거
    
    const rect = targetRow.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const insertBefore = mouseY < centerY;
    
    // 인디케이터 생성
    dragInsertIndicator = document.createElement('div');
    dragInsertIndicator.className = 'drag-insert-indicator';
    
    // 위치 설정
    const container = targetRow.closest('.table-container');
    const containerRect = container.getBoundingClientRect();
    
    dragInsertIndicator.style.position = 'absolute';
    dragInsertIndicator.style.left = containerRect.left + 'px';
    dragInsertIndicator.style.width = containerRect.width + 'px';
    
    if (insertBefore) {
        dragInsertIndicator.style.top = (rect.top - 2) + 'px';
    } else {
        dragInsertIndicator.style.top = (rect.bottom - 1) + 'px';
    }
    
    document.body.appendChild(dragInsertIndicator);
}

function hideDragInsertIndicator() {
    if (dragInsertIndicator) {
        dragInsertIndicator.remove();
        dragInsertIndicator = null;
    }
}

// 완전 백업 함수 (임시)
function createCompleteBackup() {
    const allData = {
        taskData: taskData || {},
        tabNames: tabNames || [],
        columnNamesByTab: columnNamesByTab || {},
        columnWidthsByTab: columnWidthsByTab || {},
        currentTab: currentTab || 0,
        nextTabId: nextTabId || 1,
        history: undoHistory || [],
        backupDate: new Date().toISOString(),
        version: "pre-firebase-backup"
    };
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complete-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ 완전 백업 완료!');
    alert('백업 파일이 다운로드되었습니다!');
}

// 페이지 로드 시 백업 버튼 추가
document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container');
    const backupBtn = document.createElement('button');
    backupBtn.textContent = '🔄 완전 백업';
    backupBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; background: #ff6b6b; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;';
    backupBtn.onclick = createCompleteBackup;
    document.body.appendChild(backupBtn);
});

// 수동 마이그레이션 함수 추가
async function forceLocalToFirebaseMigration() {
    if (!currentUser || !isOnlineMode) {
        alert('구글 로그인이 필요합니다.');
        return;
    }
    
    console.log('🔄 강제 마이그레이션 시작...');
    
    // 기존 로컬 데이터 로드
    loadData();
    
    // Firebase에 저장
    await saveUserDataToFirebase();
    
    // UI 새로고침
    renderTabs();
    renderAllTables();
    
    alert('✅ 기존 할일 데이터가 구글 계정으로 이전되었습니다!');
    console.log('✅ 마이그레이션 완료!');
}

