"""
Intent Classifier / Router pour Talos.
Détecte l'intention de l'utilisateur pour router vers le bon SKILL.md.
"""

def classify_intent(message: str) -> str:
    """
    Analyse le message de l'utilisateur et retourne le système de prompts cible.
    Modes possibles : agent, builder, docs, sheets, pdf, slides, chat
    """
    if not message:
        return "agent"
        
    msg = message.lower()
    
    # 1. Builder (React, Web Apps)
    if any(k in msg for k in ['webapp', 'web app', 'react', 'next', 'nextjs', 'website', 'application web', 'site web', 'fullstack', 'tailwind']):
        return 'builder'
        
    # 2. Sheets (XLSX, Data)
    if any(k in msg for k in ['excel', 'xlsx', 'tableur', 'sheets', 'spreadsheet', 'csv']):
        return 'sheets'
        
    # 3. Docs (Word)
    if any(k in msg for k in ['word', 'docx', 'document texte']):
        return 'docs'
        
    # 4. PDF (Reports, Latex)
    if any(k in msg for k in ['pdf', 'latex', 'rapport pdf']):
        return 'pdf'
        
    # 5. Slides (Presentations, Pitch Decks)
    if any(k in msg for k in ['powerpoint', 'slides', 'presentation', 'diapo', 'pitch deck', 'pptx']):
        return 'slides'
        
    # 6. Base Chat (Lightweight conversational mode)
    chat_keywords = ['bonjour', 'salut', 'qui es-tu', 'comment vas', 'hello', 'hi']
    if any(k in msg for k in chat_keywords):
        # Si c'est un court message / salutation
        if len(msg.split()) < 10:
            return 'chat'
            
    # Default fallback - The OK Computer core agent
    return 'agent'
