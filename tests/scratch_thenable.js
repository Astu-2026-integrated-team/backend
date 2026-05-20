const queryResults = [{ data: 'hello' }];
const mockSupabase = {
  from() { return this; },
  select() { return this; },
  eq() { return this; },
  then(resolve, reject) {
    console.log('then called!');
    const next = queryResults.shift();
    resolve(next);
  }
};

async function run() {
  console.log('awaiting mockSupabase...');
  const res = await mockSupabase.from().select().eq();
  console.log('result:', res);
}

run().catch(console.error);
