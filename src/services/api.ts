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
