# 학생 모듈 API

교사는 렌더링·카메라·임시 캐릭터·키 입력·중력·충돌·낙하 복귀·로컬 서버·GLB 로더를 제공한다. 학생 AI는 이동, 점프, 코스 데이터, 쉼터 저장, 캐릭터 선택과 동작 연결을 실제로 작성한다. 기본판에는 이동·점프·쉼터 함수 본문이 비어 있고, 시작 발판 하나만 있다.

## 공통 상태

- `player.x/y/z`: 위치(m). `y`는 발 높이. 엔진이 좌표를 갱신한다.
- `player.vx/vy/vz`: 초당 속도(m/s). +x 오른쪽, -z 앞으로, +y 위쪽.
- `player.grounded`: 현재 땅에 서 있는지.
- `player.platformId`: 밟은 발판 번호, 공중에서는 null.
- `player.spawn`: 낙하 시 돌아갈 `{ x, y, z }`. 처음에는 시작 위치.
- `player.checkpointId`: 저장한 쉼터 번호. 초기값 0.
- `player.won`: 정상 도착 여부. 교사 엔진이 처리한다.
- `input.x`, `input.z`: 키에서 얻은 -1/0/1. 동시에 누르면 대각선이다.
- `input.freshJump`: 이번 프레임에 점프를 새로 눌렀는지. 길게 누르면 false로 돌아간다.
- `dt`: 한 번 갱신하는 시간(초). 엔진은 1/120초 간격으로 실행한다.

## 함수

`applyMovement(player,input,dt)`는 `vx/vz`만 쓴다. 입력을 길이 1 이하로 정규화하고 속도 4를 곱한다. 입력이 없으면 두 속도는 0이다. 좌표에 dt를 직접 더하지 않는다.

`applyJump(player,input,dt)`는 grounded와 freshJump가 모두 true이면 `vy=8`, `grounded=false`를 쓴다. 다른 경우 상태를 바꾸지 않는다. 중력은 엔진에서 20m/s²로 적용한다.

`COURSE`는 `{id,x,y,z,width,depth,checkpoint,finish}` 객체 배열이다. y는 윗면. id는 0부터 증가한다. width/depth는 양수. 마지막 발판만 finish=true로 둔다.

`onLand(player,platform)`는 새로 착지할 때 호출된다. platform.checkpoint가 true일 때 `player.spawn={x:platform.x,y:platform.y,z:platform.z}`와 `player.checkpointId=platform.id`를 저장한다.

`createAvatar(scene)`는 async 함수이며 `{object,kind,animation,update(player,dt),dispose()}`를 반환한다. object는 THREE.Object3D. 엔진이 object의 위치와 방향을 플레이어에 맞춘다. update에서는 동작만 갱신한다. kind는 임시 모델이면 'practice', GLB이면 'rigged'. animation은 현재 동작 이름을 보여 주는 문자열이다.

## 캐릭터 유틸

`avatar-utils.js`의 `loadRiggedAvatar('./assets/class_character.glb')`는 Promise이며 `{object,animationRoot,clips}`를 반환한다. 로딩·키 1.4m 맞추기·발 원점·정면 방향 보정은 이 공통 유틸이 담당한다. `clips`에는 이름이 정확히 `Idle`, `Run`인 애니메이션 2개가 있다. 학생은 `THREE.AnimationMixer(animationRoot)`, clipAction과 update(dt)를 직접 연결한다. 이 GLB에는 전용 Jump 클립이 없다.

## 확인

파일을 저장한 뒤 브라우저를 새로고침한다. WASD/방향키 이동, Space 점프, Esc 일시정지, R 저장된 위치 복귀. 화면의 관찰용 `data-player`·`data-course-count`·`data-avatar-status`·`data-animation`은 엔진 상태를 보여 주며 게임을 변경하는 API가 아니다.
