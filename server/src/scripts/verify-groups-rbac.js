import { pool } from "../config/database.js";
import * as groupService from "../services/group.service.js";
import * as conversationService from "../services/conversation.service.js";
import { ROLES } from "../constants/roles.js";

async function verifyGroupsRBAC() {
  console.log("Starting Module 5 Groups & RBAC Verification...\n");
  let passed = 0;
  let total = 0;

  // Retrieve seed users: Alice, Bob, Charlie, Diana, Ethan, Fiona
  const { rows: users } = await pool.query("SELECT id, name, email FROM users ORDER BY email ASC");
  const alice = users.find((u) => u.email.startsWith("alice"));
  const bob = users.find((u) => u.email.startsWith("bob"));
  const charlie = users.find((u) => u.email.startsWith("charlie"));
  const diana = users.find((u) => u.email.startsWith("diana"));

  let testGroupId;

  // Test 1: Group Creation & Automatic OWNER Role
  total++;
  try {
    const group = await groupService.createGroup({
      creatorId: alice.id,
      name: "Engineering Core",
      avatarUrl: "https://example.com/eng.png",
    });

    testGroupId = group.id;
    const ownerMember = group.members.find((m) => m.id === alice.id);

    if (group.id && group.type === "GROUP" && ownerMember?.role === ROLES.OWNER) {
      console.log(`✓ PASS: Group created with Alice as OWNER (${group.id})`);
      passed++;
    } else {
      console.error("FAIL: Group creation failed:", group);
    }
  } catch (err) {
    console.error("FAIL in group creation:", err.message);
  }

  // Test 2: Add Member by Owner (adds as MEMBER)
  total++;
  try {
    const addedBob = await groupService.addMember({
      conversationId: testGroupId,
      actorId: alice.id,
      targetUserId: bob.id,
    });

    const addedCharlie = await groupService.addMember({
      conversationId: testGroupId,
      actorId: alice.id,
      targetUserId: charlie.id,
    });

    if (addedBob.role === ROLES.MEMBER && addedCharlie.role === ROLES.MEMBER) {
      console.log("✓ PASS: Owner added Bob and Charlie with role MEMBER");
      passed++;
    } else {
      console.error("FAIL in add member roles:", { addedBob, addedCharlie });
    }
  } catch (err) {
    console.error("FAIL in add member test:", err.message);
  }

  // Test 3: Duplicate member rejection (409 ALREADY_MEMBER)
  total++;
  try {
    await groupService.addMember({
      conversationId: testGroupId,
      actorId: alice.id,
      targetUserId: bob.id,
    });
    console.error("FAIL: Duplicate member was allowed!");
  } catch (err) {
    if (err.code === "ALREADY_MEMBER") {
      console.log("✓ PASS: Duplicate member rejected with 409 ALREADY_MEMBER");
      passed++;
    } else {
      console.error("FAIL in duplicate member check:", err.message);
    }
  }

  // Test 4: Member role cannot add members (403 FORBIDDEN)
  total++;
  try {
    await groupService.addMember({
      conversationId: testGroupId,
      actorId: bob.id, // Bob is MEMBER
      targetUserId: diana.id,
    });
    console.error("FAIL: Standard member was allowed to add members!");
  } catch (err) {
    if (err.statusCode === 403) {
      console.log("✓ PASS: Standard member denied from adding members (403 FORBIDDEN)");
      passed++;
    } else {
      console.error("FAIL in member add permission:", err.message);
    }
  }

  // Test 5: Owner promotes Member to Admin
  total++;
  try {
    const promoted = await groupService.changeMemberRole({
      conversationId: testGroupId,
      actorId: alice.id,
      targetUserId: bob.id,
      newRole: ROLES.ADMIN,
    });

    if (promoted.role === ROLES.ADMIN) {
      console.log("✓ PASS: Owner promoted Bob to ADMIN");
      passed++;
    } else {
      console.error("FAIL in promote role:", promoted);
    }
  } catch (err) {
    console.error("FAIL in promote test:", err.message);
  }

  // Test 6: Admin can add members
  total++;
  try {
    const addedDiana = await groupService.addMember({
      conversationId: testGroupId,
      actorId: bob.id, // Bob is now ADMIN
      targetUserId: diana.id,
    });

    if (addedDiana.role === ROLES.MEMBER) {
      console.log("✓ PASS: Admin (Bob) successfully added Diana as MEMBER");
      passed++;
    } else {
      console.error("FAIL in admin adding member:", addedDiana);
    }
  } catch (err) {
    console.error("FAIL in admin add member:", err.message);
  }

  // Test 7: Admin cannot promote or change roles (403 FORBIDDEN)
  total++;
  try {
    await groupService.changeMemberRole({
      conversationId: testGroupId,
      actorId: bob.id, // Bob is ADMIN
      targetUserId: charlie.id,
      newRole: ROLES.ADMIN,
    });
    console.error("FAIL: Admin was allowed to change member roles!");
  } catch (err) {
    if (err.statusCode === 403) {
      console.log("✓ PASS: Admin denied from changing roles (403 FORBIDDEN)");
      passed++;
    } else {
      console.error("FAIL in admin change role:", err.message);
    }
  }

  // Test 8: Admin cannot remove another Admin or Owner (403 FORBIDDEN)
  total++;
  try {
    // Promote Charlie to Admin first via Alice
    await groupService.changeMemberRole({
      conversationId: testGroupId,
      actorId: alice.id,
      targetUserId: charlie.id,
      newRole: ROLES.ADMIN,
    });

    // Bob (Admin) tries to remove Charlie (Admin)
    await groupService.removeMember({
      conversationId: testGroupId,
      actorId: bob.id,
      targetUserId: charlie.id,
    });
    console.error("FAIL: Admin was allowed to remove another Admin!");
  } catch (err) {
    if (err.statusCode === 403) {
      console.log("✓ PASS: Admin denied from removing another Admin (403 FORBIDDEN)");
      passed++;
    } else {
      console.error("FAIL in admin removing admin:", err.message);
    }
  }

  // Test 9: Admin CAN remove normal member (Diana)
  total++;
  try {
    const removeResult = await groupService.removeMember({
      conversationId: testGroupId,
      actorId: bob.id,
      targetUserId: diana.id,
    });

    if (removeResult.success && removeResult.removedUserId === diana.id) {
      console.log("✓ PASS: Admin successfully removed normal MEMBER (Diana)");
      passed++;
    } else {
      console.error("FAIL in removing member:", removeResult);
    }
  } catch (err) {
    console.error("FAIL in admin remove normal member:", err.message);
  }

  // Test 10: Removed member is denied conversation access (404 CONVERSATION_NOT_FOUND)
  total++;
  try {
    const conv = await conversationService.getConversation({
      conversationId: testGroupId,
      userId: diana.id,
    });

    if (conv === null) {
      console.log("✓ PASS: Removed member receives null / 404 access denied");
      passed++;
    } else {
      console.error("FAIL: Removed member still has access:", conv);
    }
  } catch (err) {
    console.error("FAIL in removed member access test:", err.message);
  }

  // Test 11: Owner cannot be removed (400 OWNER_CANNOT_BE_REMOVED)
  total++;
  try {
    await groupService.removeMember({
      conversationId: testGroupId,
      actorId: alice.id,
      targetUserId: alice.id,
    });
    console.error("FAIL: Owner was allowed to remove themselves!");
  } catch (err) {
    if (err.code === "OWNER_CANNOT_BE_REMOVED") {
      console.log("✓ PASS: Owner removal rejected with OWNER_CANNOT_BE_REMOVED");
      passed++;
    } else {
      console.error("FAIL in owner removal rejection:", err.message);
    }
  }

  // Test 12: Atomic Ownership Transfer (Alice -> Bob)
  total++;
  try {
    const transferResult = await groupService.transferOwnership({
      conversationId: testGroupId,
      currentOwnerId: alice.id,
      newOwnerId: bob.id,
    });

    const newOwner = transferResult.members.find((m) => m.id === bob.id);
    const oldOwner = transferResult.members.find((m) => m.id === alice.id);

    if (newOwner?.role === ROLES.OWNER && oldOwner?.role === ROLES.ADMIN) {
      console.log("✓ PASS: Ownership transferred atomically: Bob is now OWNER, Alice is ADMIN");
      passed++;
    } else {
      console.error("FAIL in ownership transfer:", { newOwner, oldOwner });
    }
  } catch (err) {
    console.error("FAIL in ownership transfer test:", err.message);
  }

  // Test 13: Group Deletion by new Owner (Bob)
  total++;
  try {
    // Charlie (Admin) tries to delete first -> should fail
    try {
      await groupService.deleteGroup({
        conversationId: testGroupId,
        userId: charlie.id,
      });
      console.error("FAIL: Admin was permitted to delete group!");
    } catch (err) {
      if (err.statusCode === 403) {
        // Now new Owner (Bob) deletes -> should succeed
        const deleteResult = await groupService.deleteGroup({
          conversationId: testGroupId,
          userId: bob.id,
        });

        if (deleteResult.success) {
          console.log("✓ PASS: Admin denied deletion (403), Owner successfully deleted group");
          passed++;
        }
      }
    }
  } catch (err) {
    console.error("FAIL in delete group test:", err.message);
  }

  console.log(`\nGroups & RBAC Verification Completed: ${passed}/${total} checks passed.`);
  await pool.end();
}

verifyGroupsRBAC().catch((err) => {
  console.error("RBAC Verification Error:", err);
  process.exit(1);
});
