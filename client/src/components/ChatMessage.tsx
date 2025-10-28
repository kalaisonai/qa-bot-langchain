import ReactMarkdown from 'react-markdown'
import './ChatMessage.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Props {
  message: Message
}

function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  // Parse tables from markdown-style content
  const renderContent = () => {
    const content = message.content

    // Check if content has table-like structure (| separators)
    if (content.includes('|') && content.includes('\n')) {
      return (
        <div className="markdown-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )
    }

    // Check for numbered lists or bullet points
    if (/^\d+\.|^-|^\*/.test(content.trim())) {
      return (
        <div className="markdown-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )
    }

    // Plain text
    return <div className="plain-text">{content}</div>
  }

  return (
    <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
          <span className="message-time">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <div className="message-body">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default ChatMessage
