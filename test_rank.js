const axios = require('axios');

async function testSystem() {
    const baseUrl = 'http://135.181.98.134:3001';

    try {
        console.log("--- fetching users ---");
        const usersRes = await axios.get(`${baseUrl}/auth/admin/users`);
        if (!usersRes.data.success || usersRes.data.users.length === 0) {
            console.error("No users found or admin endpoint failed.");
            return;
        }

        const realUser = usersRes.data.users[0];
        const userId = realUser.id;
        console.log(`Using User: ${realUser.firstName} (ID: ${userId}, Grade: ${realUser.grade})`);

        // 1. Get initial state
        console.log("1. Fetching Rank/Profile...");
        const res1 = await axios.get(`${baseUrl}/auth/rank/${userId}`);
        console.log("   Initial State:", res1.data);
        const initialRating = res1.data.rating || 0;

        // 2. Simulate Win
        console.log("\n2. Simulating Win for User...");
        // winnerId: userId, loserId: someOtherId (e.g. 2)
        // We need a loser ID too. preferably another real user to avoid FK errors if strict
        const loserId = usersRes.data.users.length > 1 ? usersRes.data.users[1].id : 999999;

        await axios.post(`${baseUrl}/auth/results`, {
            winnerId: userId,
            loserId: loserId,
            isDraw: false,
            player1Id: userId,
            player2Id: loserId,
            p1Score: 10,
            p2Score: 5
        });
        console.log("   Win reported.");

        // 3. Check state again
        console.log("\n3. Fetching Rank/Profile again...");
        const res2 = await axios.get(`${baseUrl}/auth/rank/${userId}`);
        console.log("   New State:", res2.data);

        if (res2.data.rating > initialRating) {
            console.log("✅ SUCCESS: Rating increased!");
        } else {
            console.log("❌ FAILURE: Rating did not change.");
        }

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error("Data:", e.response.data);
    }
}

testSystem();
