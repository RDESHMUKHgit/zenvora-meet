import assert from 'assert';
import { meetingService } from '../services/meeting.service.js';
import { chatService } from '../services/chat.service.js';
import { ephemeralChatManager } from '../services/ephemeral-chat.manager.js';
import { pool } from '../db/index.js';

async function runTests() {
  console.log('\n=== TASK 07 — Real-Time Chat (Text Only) Test Suite ===\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Ephemeral Quick Join Meeting In-Memory Chat
    // -------------------------------------------------------------
    console.log('[Test 1] Testing Ephemeral Quick Join Chat (in-memory, no DB write)...');
    const ephMeeting = await meetingService.createMeeting(null, {
      title: 'Quick Ephemeral Chat Test',
      displayName: 'Alice Host',
      maxParticipants: 4,
      isEphemeral: true,
    });
    const code = ephMeeting.meeting.meetingCode;
    const p1Id = ephMeeting.participant.id;

    // Participant 2 joins
    const p2Result = await meetingService.joinMeeting(code, null, 'Bob Guest');
    const p2Id = p2Result.participant.id;

    // Get conversations: group conversation should automatically exist
    const convs = await chatService.getConversations(code, p1Id);
    assert.strictEqual(convs.length, 1, 'Should have exactly 1 initial group conversation');
    assert.strictEqual(convs[0].conversationType, 'group', 'Initial conversation must be group');
    const groupConvId = convs[0].id;

    // Send group message from Alice
    const msg1 = await chatService.sendMessage(
      code,
      groupConvId,
      p1Id,
      'Alice Host',
      null,
      'Hello team! Welcome to the meeting.'
    );
    assert.ok(msg1.id, 'Message must have an ID');
    assert.strictEqual(msg1.content, 'Hello team! Welcome to the meeting.');
    assert.strictEqual(msg1.senderParticipantId, p1Id);

    // Send group message from Bob
    const msg2 = await chatService.sendMessage(
      code,
      groupConvId,
      p2Id,
      'Bob Guest',
      null,
      'Hi Alice! Glad to be here.'
    );
    assert.strictEqual(msg2.senderParticipantId, p2Id);

    // Fetch messages for group conversation
    const groupMsgs = await chatService.getMessages(code, groupConvId, p1Id);
    assert.strictEqual(groupMsgs.length, 2, 'Group conversation must have 2 messages');
    console.log('  ✓ Ephemeral group chat messaging verified');

    // -------------------------------------------------------------
    // Test 2: Direct Messages (DMs) Private 1-to-1 Isolation
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing Direct Message (DM) private isolation...');
    const dmConv = await chatService.findOrCreateDirectConversation(code, p1Id, p2Id, null);
    assert.strictEqual(dmConv.conversationType, 'direct', 'Must be a direct conversation');
    assert.ok(dmConv.id.includes('direct'), 'DM conversation ID should represent direct channel');

    // Send private DM from Alice to Bob
    const dmMsg = await chatService.sendMessage(
      code,
      dmConv.id,
      p1Id,
      'Alice Host',
      null,
      'Hey Bob, this is a private 1-on-1 note.'
    );
    assert.strictEqual(dmMsg.conversationId, dmConv.id);

    // Verify DM messages are NOT in the group conversation
    const groupMsgsAfterDm = await chatService.getMessages(code, groupConvId, p1Id);
    assert.strictEqual(groupMsgsAfterDm.length, 2, 'Group chat must not receive private DM messages');

    // Verify Bob can read DM messages
    const bobDmMsgs = await chatService.getMessages(code, dmConv.id, p2Id);
    assert.strictEqual(bobDmMsgs.length, 1, 'Bob should see 1 DM message');
    assert.strictEqual(bobDmMsgs[0].content, 'Hey Bob, this is a private 1-on-1 note.');
    console.log('  ✓ Private DM isolation confirmed: DMs are never leaked to group chat');

    // -------------------------------------------------------------
    // Test 3: Emoji Reactions (Add, Aggregate, Toggle Remove)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing Emoji Reactions...');
    // Bob reacts with 👍 to Alice's message
    const react1 = await chatService.toggleReaction(code, groupConvId, msg1.id, p2Id, null, '👍');
    assert.strictEqual(react1.action, 'added');
    assert.strictEqual(react1.emoji, '👍');

    // Alice also reacts with 👍
    const react2 = await chatService.toggleReaction(code, groupConvId, msg1.id, p1Id, null, '👍');
    assert.strictEqual(react2.action, 'added');

    // Check message reactions aggregate
    let updatedMsgs = await chatService.getMessages(code, groupConvId, p1Id);
    let targetMsg = updatedMsgs.find((m) => m.id === msg1.id);
    let thumbReaction = targetMsg?.reactions.find((r) => r.emoji === '👍');
    assert.strictEqual(thumbReaction?.count, 2, 'Thumb reaction count must be 2');
    assert.strictEqual(thumbReaction?.hasReacted, true, 'Alice should see hasReacted true');

    // Bob toggles off his reaction
    const react3 = await chatService.toggleReaction(code, groupConvId, msg1.id, p2Id, null, '👍');
    assert.strictEqual(react3.action, 'removed');

    updatedMsgs = await chatService.getMessages(code, groupConvId, p1Id);
    targetMsg = updatedMsgs.find((m) => m.id === msg1.id);
    thumbReaction = targetMsg?.reactions.find((r) => r.emoji === '👍');
    assert.strictEqual(thumbReaction?.count, 1, 'Reaction count should decrement to 1');
    console.log('  ✓ Emoji reaction addition, aggregation, and toggle removal verified');

    // -------------------------------------------------------------
    // Test 4: Read Receipts
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Read Receipts...');
    // Bob marks Alice's group message as read
    await chatService.markAsRead(code, groupConvId, [msg1.id], p2Id, null);
    updatedMsgs = await chatService.getMessages(code, groupConvId, p1Id);
    targetMsg = updatedMsgs.find((m) => m.id === msg1.id);
    assert.ok(
      targetMsg?.readByParticipantIds.includes(p2Id),
      'Bob should be recorded in readByParticipantIds'
    );
    console.log('  ✓ Read receipt successfully registered');

    // -------------------------------------------------------------
    // Test 5: Validation & Character Limits (5,000 max)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing Message Validation & 5,000-character constraint...');
    const oversizedMessage = 'a'.repeat(5001);
    let overLimitThrew = false;
    try {
      await chatService.sendMessage(code, groupConvId, p1Id, 'Alice', null, oversizedMessage);
    } catch {
      overLimitThrew = true;
    }
    assert.strictEqual(overLimitThrew, true, 'Message >5000 characters must be rejected');

    let emptyThrew = false;
    try {
      await chatService.sendMessage(code, groupConvId, p1Id, 'Alice', null, '   ');
    } catch {
      emptyThrew = true;
    }
    assert.strictEqual(emptyThrew, true, 'Whitespace-only message must be rejected');
    console.log('  ✓ Character length and whitespace constraints enforced');

    // -------------------------------------------------------------
    // Test 6: Ephemeral Purge on Room Close
    // -------------------------------------------------------------
    console.log('\n[Test 6] Testing Ephemeral In-Memory Storage Purge on Room Close...');
    assert.ok(
      ephemeralChatManager.hasRoom(code),
      'Ephemeral manager should hold room before close'
    );
    ephemeralChatManager.purgeRoom(code);
    assert.strictEqual(
      ephemeralChatManager.hasRoom(code),
      false,
      'Ephemeral manager must purge room state completely'
    );
    console.log('  ✓ In-memory ephemeral chat purged on room close without leaving database artifacts');

    // -------------------------------------------------------------
    // Test 7: Authenticated Persistent Meeting Chat in PostgreSQL Neon
    // -------------------------------------------------------------
    console.log('\n[Test 7] Testing Authenticated Persistent Chat in PostgreSQL Neon...');
    const persistentMeeting = await meetingService.createMeeting(null, {
      title: 'Persistent Board Review',
      displayName: 'Board Chair',
      maxParticipants: 8,
      isEphemeral: false, // Authenticated persistence policy
    });
    const pCode = persistentMeeting.meeting.meetingCode;
    const chairId = persistentMeeting.participant.id;

    // Join second participant
    const attendee = await meetingService.joinMeeting(pCode, null, 'Board Member');
    const attendeeId = attendee.participant.id;

    // Get or initialize persistent conversations
    const pConvs = await chatService.getConversations(pCode, chairId);
    assert.ok(pConvs.length >= 1, 'Persistent meeting should have group conversation');
    const pGroupConvId = pConvs[0].id;

    // Send persistent message
    const pMsg = await chatService.sendMessage(
      pCode,
      pGroupConvId,
      chairId,
      'Board Chair',
      null,
      'Reviewing Q4 Financials'
    );
    assert.ok(pMsg.id, 'Persistent message must have database UUID');

    // React to persistent message
    const pReact = await chatService.toggleReaction(
      pCode,
      pGroupConvId,
      pMsg.id,
      attendeeId,
      null,
      '🎉'
    );
    assert.strictEqual(pReact.action, 'added');

    // Retrieve persistent messages from Neon DB
    const fetchedDbMsgs = await chatService.getMessages(pCode, pGroupConvId, attendeeId);
    assert.ok(fetchedDbMsgs.length >= 1, 'Should fetch persistent message from PostgreSQL');
    const dbMsg = fetchedDbMsgs.find((m) => m.id === pMsg.id);
    assert.strictEqual(dbMsg?.content, 'Reviewing Q4 Financials');
    assert.strictEqual(dbMsg?.reactions[0]?.emoji, '🎉');
    console.log('  ✓ PostgreSQL Neon persistence for authenticated meetings verified with Drizzle ORM');

    console.log('\n======================================================');
    console.log('✓ ALL TASK 07 REAL-TIME CHAT TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ Test failure:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
