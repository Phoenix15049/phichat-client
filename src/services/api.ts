import axios from 'axios'

const API = axios.create({
  baseURL: 'https://localhost:7146/api',
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
})

export async function getConversationWith(userId: string) {
  const res = await API.get(`/messages/with/${userId}`)
  return res.data
}

export async function getUserList() {
  const res = await API.get('/users/list')
  return res.data
}

export async function getPublicKey(userId: string) {
  const res = await API.get(`/users/id/${userId}/public-key`)
  return res.data.publicKey
}

export async function storeChatKey(receiverId: string, encryptedKey: string) {
  return API.post('/keys', {
    receiverId,
    encryptedKeyBase64: encryptedKey
  });
}

export async function getChatKey(otherUserId: string): Promise<string | null> {
  try {
    const res = await API.get(`/keys/${otherUserId}`);
    return res.data;
  } catch {
    return null;
  }
}


export async function getUserById(userId: string): Promise<{ id: string; username: string; publicKey: string }> {
  const res = await API.get(`/users/${userId}`);
  return res.data;
}
