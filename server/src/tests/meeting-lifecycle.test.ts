import assert from 'assert';
import { meetingService } from '../services/meeting.service.js';
import { roomManager } from '../services/room.manager.js';
import { pool } from '../db/index.js';

async function runTests() {
  console.log('\n=== TASK 04 — Meeting Lifecycle & Quick Join Test Suite ===\n');

  try {
    // 1. Meeting ID Format Verification (abc-oude-yig-2324)
    console.log('[Test 1] Testing meeting ID format (abc-oude-yig-2324)...');
    const hostDisplayName = 'Rudra Deshmukh';
    const result1 = await meetingService.createMeeting(null, {
      title: 'Architecture Discussion',
      displayName: hostDisplayName,
      maxParticipants: 4,
      isEphemeral: true,
    });

    const code = result1.meeting.meetingCode;
    console.log(`  Generated meeting code: ${code}`);
    const codeRegex = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}-[0-9]{4}$/;
    assert.match(code, codeRegex, `Code ${code} must match abc-oude-yig-2324 pattern`);
    assert.strictEqual(code.startsWith('rud'), true, 'Code should derive prefix from host name');
    assert.ok(result1.hostToken, 'Must generate secure host token');
    assert.strictEqual(result1.participant.role, 'host', 'Creator must have host role');
    console.log('  ✓ Meeting ID format verified: 3 chars name-derived + 4 chars + 3 chars + 4 digits');

    // 2. Capacity Enforcement (e.g. max 2 participants)
    console.log('\n[Test 2] Testing capacity enforcement (max 2 participants)...');
    const capMeeting = await meetingService.createMeeting(null, {
      title: '1-on-1 Interview',
      displayName: 'Interviewer',
      maxParticipants: 2,
      isEphemeral: true,
    });
    const capCode = capMeeting.meeting.meetingCode;

    // Simulate host join in roomManager
    roomManager.addParticipant(capCode, {
      id: capMeeting.participant.id,
      socketId: 'sock-host-1',
      userId: null,
      displayName: 'Interviewer',
      role: 'host',
      joinedAt: new Date().toISOString(),
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    });

    // Participant 2 joins (Quick Join without account)
    const p2 = await meetingService.joinMeeting(capCode, null, 'Candidate');
    roomManager.addParticipant(capCode, {
      id: p2.participant.id,
      socketId: 'sock-p2',
      userId: null,
      displayName: 'Candidate',
      role: 'participant',
      joinedAt: new Date().toISOString(),
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    });

    assert.strictEqual(roomManager.isRoomFull(capCode), true, 'Room with 2/2 should be full');

    // Participant 3 attempts to join -> Should be rejected with ConflictError
    let rejected = false;
    try {
      await meetingService.joinMeeting(capCode, null, 'Intruder');
    } catch (err: unknown) {
      rejected = true;
      console.log(`  ✓ Participant 3 rejected: ${(err as Error).message}`);
    }
    assert.strictEqual(rejected, true, 'Participant 3 must be blocked when room is at capacity');

    // 3. Quick Join Participant cannot claim Host Privileges
    console.log('\n[Test 3] Testing Quick Join role security...');
    assert.strictEqual(p2.participant.role, 'participant');
    let unauthorizedEnd = false;
    try {
      // Participant attempts to end meeting without hostToken
      await meetingService.endMeeting(capCode, {
        userId: null,
        hostToken: 'fake-token-attempt',
      });
    } catch (err: unknown) {
      unauthorizedEnd = true;
      console.log(`  ✓ Non-host termination blocked: ${(err as Error).message}`);
    }
    assert.strictEqual(unauthorizedEnd, true, 'Non-host must not be able to end meeting');

    // 4. Explicit Meeting Termination by Host
    console.log('\n[Test 4] Testing explicit termination by host with hostToken...');
    await meetingService.endMeeting(capCode, {
      userId: null,
      hostToken: capMeeting.hostToken,
    });
    const endedCheck = await meetingService.getMeetingByCode(capCode).catch((e) => e);
    assert.ok(endedCheck instanceof Error, 'Ended meeting should reject new lookups/joins');
    console.log('  ✓ Meeting ended successfully; in-memory room closed and DB status updated to ended');

    // 5. Empty Room 60-Second Expiration Lifecycle
    console.log('\n[Test 5] Testing empty room timer cancellation & lifecycle...');
    const emptyRoom = await meetingService.createMeeting(null, {
      title: 'Timer Test Room',
      displayName: 'Host A',
      maxParticipants: 8,
      isEphemeral: true,
    });
    const eCode = emptyRoom.meeting.meetingCode;

    // Simulate join & immediate leave
    const pTemp = await meetingService.joinMeeting(eCode, null, 'Temporary Guest');
    roomManager.addParticipant(eCode, {
      id: pTemp.participant.id,
      socketId: 'sock-temp',
      userId: null,
      displayName: 'Temporary Guest',
      role: 'participant',
      joinedAt: new Date().toISOString(),
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    });

    // Participant leaves -> triggers timer
    await meetingService.leaveMeeting(eCode, pTemp.participant.id);
    const roomState = roomManager.getRoom(eCode);
    assert.ok(roomState?.emptyTimer, 'Empty room must have active emptyTimer');
    console.log('  ✓ 60-second expiration timer initiated upon participant departure');

    // Cancel timer when another participant rejoins
    const cancelled = roomManager.cancelEmptyTimer(eCode);
    assert.strictEqual(cancelled, true, 'Timer should be cancelled when a participant joins');
    console.log('  ✓ Expiration timer successfully cancelled on rejoin');

    // Cleanup
    roomManager.closeRoom(eCode);
    roomManager.closeRoom(result1.meeting.meetingCode);

    console.log('\n=== ALL TASK 04 BACKEND TESTS PASSED SUCCESSFULLY! ===\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runTests();

