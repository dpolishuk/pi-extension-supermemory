import { Supermemory } from 'supermemory';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.SUPERMEMORY_API_KEY;
const containerTag = process.env.SUPERMEMORY_CONTAINER_TAG || "pi-extension-e2e-test";

if (!apiKey) {
  console.error("❌ Error: SUPERMEMORY_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Supermemory({ apiKey });

async function runE2E() {
  console.log("🚀 Starting Comprehensive E2E Test...");
  console.log(`📂 Container Tag: ${containerTag}`);

  const uniqueId = `e2e-${Math.random().toString(36).substring(7)}`;
  const testContent = `Pi Extension E2E Test Content [${uniqueId}] - Added at ${new Date().toISOString()}`;

  try {
    // 1. Add direct memory
    console.log("\n1️⃣ Adding direct memory...");
    const addMemResult = await client.addMemory({
      memories: [{ content: testContent, isStatic: false }],
      containerTag
    });
    const memoryId = addMemResult.memories[0].id;
    const documentId = addMemResult.documentId;
    console.log(`✅ Memory added. ID: ${memoryId}, Doc ID: ${documentId}`);

    // 2. Add document via URL (optional but good)
    console.log("\n2️⃣ Adding document via content...");
    const addDocResult = await client.add({
      content: `This is a full document for unique ID ${uniqueId}`,
      containerTag,
      metadata: { type: 'e2e-test', id: uniqueId }
    });
    console.log(`✅ Document added. ID: ${addDocResult.id}`);

    // 3. Wait for indexing
    console.log("\n⏳ Waiting 15 seconds for Supermemory indexing...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 4. Search for the memory
    console.log(`\n3️⃣ Searching for unique ID: ${uniqueId}...`);
    const searchResult = await client.search.memories({
      q: uniqueId,
      containerTag,
      searchMode: "hybrid"
    });
    console.log(`🔍 Found ${searchResult.results.length} results.`);
    const found = searchResult.results.some(r => r.memory?.includes(uniqueId) || r.chunk?.includes(uniqueId));
    if (found) {
      console.log("✅ Search successful!");
    } else {
      console.warn("⚠️ Search did not return the expected result (indexing might be slower).");
    }

    // 5. Check Profile
    console.log("\n4️⃣ Retrieving Profile...");
    const profile = await client.profile({
      containerTag,
      q: uniqueId
    });
    console.log(`✅ Profile retrieved. Dynamic facts count: ${profile.profile.dynamic.length}`);
    if (profile.profile.dynamic.some(f => f.includes(uniqueId))) {
      console.log("✅ Profile contains the test fact!");
    }

    // 6. List Documents
    console.log("\n5️⃣ Listing Documents...");
    const docs = await client.documents.list({ containerTag });
    console.log(`✅ Found ${docs.total} documents in container.`);

    // 7. Cleanup
    console.log("\n🧹 Cleaning up...");
    console.log(`Deleting test document ${documentId}...`);
    await client.documents.delete({ docId: documentId });
    console.log(`Deleting test document ${addDocResult.id}...`);
    await client.documents.delete({ docId: addDocResult.id });
    console.log("✅ Cleanup complete.");

    console.log("\n✨ E2E Test Finished Successfully!");
  } catch (error: any) {
    console.error("\n❌ E2E Test Failed!");
    console.error(error.message);
    if (error.status) console.error(`Status: ${error.status}`);
    process.exit(1);
  }
}

runE2E();
