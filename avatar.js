import { createPracticeAvatar } from './avatar-utils.js';

// 교사의 임시 캐릭터 연결입니다. 학생 6단계에서 GLB와 Idle/Run을 연결합니다.
export async function createAvatar(scene) {
  const object = createPracticeAvatar();
  scene.add(object);
  return {
    object,
    kind: 'practice',
    animation: '기본 캐릭터',
    update(player, dt) {
      // 기본판에서는 애니메이션을 아직 연결하지 않았습니다.
    },
    dispose() { scene.remove(object); },
  };
}
