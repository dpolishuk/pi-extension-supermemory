import { expect } from 'expect';
import { Supermemory } from 'supermemory';

// Get credentials from environment variables
const apiKey = process.env.SUPERMEMORY_API_KEY;
if (!apiKey) {
  console.error("Please set SUPERMEMORY_API_KEY environment variable.");
  process.exit(1);
}

const containerTag = process.env.SUPERMEMORY_CONTAINER_TAG || "pi-user-test";
const client = new Supermemory({ apiKey });

async function runE2ETest() {
  console.log(`Starting E2E test in container: ${containerTag}`);

  // 1. Add a test memory
  const uniqueId = Math.random().toString(36).substring(7);
  const testContent = `E2E Test Memory [${uniqueId}] - ${new Date().toISOString()}`;
  console.log(`Adding memory: ${testContent}`);
  
  const addResult = await client.addMemory({
    memories: [{ content: testContent, isStatic: false }],
    containerTag
  });
  
  const documentId = addResult.documentId;
  const memoryId = addResult.memories[0].id;
  console.log(`Memory added. Doc ID: ${documentId}, Memory ID: ${memoryId}`);

  // 2. Wait for indexing
  console.log("Waiting 10 seconds for indexing...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 3. Search for the memory
  console.log(`Searching for memory using unique ID: ${uniqueId}...`);
  const searchResult = await client.search({
    q: uniqueId,
    containerTags: [containerTag],
    searchMode: "hybrid"
  });

  console.log(`Found ${searchResult.results.length} results.`);
  
  // 4. Get specific document
  console.log(`Retrieving document ${documentId}...`);
  const doc = await client.documents.get({ docId: documentId });
  console.log(`Document status: ${doc.status}`);

  // 5. Get specific memory
  console.log(`Retrieving memory ${memoryId}...`);
  const mem = await client.memories.get({ memoryId });
  console.log(`Memory content: ${mem.memory}`);

  // 6. Cleanup (Optional)
  console.log(`Deleting document ${documentId}...`);
  await client.documents.delete({ docId: documentId });
  console.log("Cleanup complete.");
}

runE2ETest().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
