import { useNavigate } from 'react-router-dom'
import UploadModal from '../components/UploadModal'

export default function Upload() {
  const navigate = useNavigate()
  return (
    <UploadModal
      onClose={() => navigate(-1)}
      onSuccess={() => navigate('/')}
    />
  )
}
