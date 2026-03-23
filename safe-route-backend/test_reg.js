
const axios = require('axios');

async function testConnection() {
  const url = 'http://10.45.129.247:3001/api/auth/register';
  console.log(`Testing registration at ${url}...`);
  try {
    const response = await axios.post(url, {
      name: 'Test Assistant',
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      phone: '1234567890'
    }, {
      timeout: 5000
    });
    console.log('Success:', response.status, response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Response:', error.response.status, error.response.data);
    } else {
      console.log('Error Message:', error.message);
    }
  }
}

testConnection();
