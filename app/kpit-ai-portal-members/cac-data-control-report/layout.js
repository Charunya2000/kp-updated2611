'use client';

import PropTypes from 'prop-types';
import { SourceProvider } from '@reducers/SourceContext';
import { ChatHistoryProvider } from '@reducers/ChatHistoryContext';
import { ChatProvider } from '@reducers/ChatContext';
import { ChatInteractionProvider } from '@reducers/ChatInteractionContext';
import { SuggestedPromptProvider } from '@reducers/SuggestedPromptContext';
import { DesignReferenceProvider } from '@/reducers/DesignReferenceContext';
import { SavedResponseProvider } from '@reducers/SavedResponseContext';
import { JiraIssueProvider } from '@reducers/JiraIssueContext';
import { UploadedDocumentProvider } from '@reducers/UploadedDocumentContext';
import { PersonaProvider } from '@/reducers/PersonaContext';
import '@styles/globals.css';
import { SavedNoteProvider } from '@reducers/SavedNoteContext';
import { DesignIndexProvider } from '@reducers/DesignIndexContext';
import { WebsiteURLProvider } from '@reducers/WebsiteURLContext';
import { SharePointFileProvider } from '@/reducers/SharePointFileContext';
import { WorkflowProvider } from '@reducers/WorkflowContext';

export default function RootLayout(props) {
  const { children } = props;
  return (
    <PersonaProvider>
      <WebsiteURLProvider>
        <SourceProvider>
          <ChatHistoryProvider>
            <ChatProvider>
              <ChatInteractionProvider>
                <SuggestedPromptProvider>
                  <WorkflowProvider>
                    <SavedNoteProvider>
                      <SavedResponseProvider>
                        <DesignReferenceProvider>
                          <DesignIndexProvider>
                            <JiraIssueProvider>
                              <UploadedDocumentProvider>
                                <SharePointFileProvider>
                                  {children}
                                </SharePointFileProvider>
                              </UploadedDocumentProvider>
                            </JiraIssueProvider>
                          </DesignIndexProvider>
                        </DesignReferenceProvider>
                      </SavedResponseProvider>
                    </SavedNoteProvider>
                  </WorkflowProvider>
                </SuggestedPromptProvider>
              </ChatInteractionProvider>
            </ChatProvider>
          </ChatHistoryProvider>
        </SourceProvider>
      </WebsiteURLProvider>
    </PersonaProvider>
  );
}

RootLayout.propTypes = {
  children: PropTypes.node
};