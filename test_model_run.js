import { calculateTaxes } from './src/app/lib/taxEngine.js';

async function run() {
  try {
    const result = await calculateTaxes({
      salary: 1500000,
      country: 'India',
      state: 'Maharashtra',
      currency: 'INR'
    });
    console.log("SUCCESS RUN (15L INR):");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("FAIL:", err);
  }
}

run();
