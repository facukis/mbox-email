document.addEventListener('DOMContentLoaded', function() {

  // Use buttons to toggle between views
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);

  // Add active state management for navigation buttons
  document.querySelectorAll('.nav-buttons .btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active class from all buttons
      document.querySelectorAll('.nav-buttons .btn').forEach(b => b.classList.remove('active'));
      // Add active class to clicked button (except logout)
      if (!this.href) {
        this.classList.add('active');
      }
    });
  });

  // By default, load the inbox and set it as active
  load_mailbox('inbox');
  document.querySelector('#inbox').classList.add('active');
});

function compose_email() {
  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  // Clear out composition fields
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';

  // Add form submission handler if not already added
  const form = document.querySelector('#compose-form');
  if (!form.hasAttribute('data-handler-added')) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      send_email();
    });
    form.setAttribute('data-handler-added', 'true');
  }
}

function send_email() {
  const recipients = document.querySelector('#compose-recipients').value;
  const subject = document.querySelector('#compose-subject').value;
  const body = document.querySelector('#compose-body').value;

  // Basic validation
  if (!recipients.trim()) {
    show_message('Please enter at least one recipient.', 'error');
    return;
  }

  // Send email via API
  fetch('/emails', {
    method: 'POST',
    body: JSON.stringify({
      recipients: recipients,
      subject: subject,
      body: body
    })
  })
  .then(response => response.json())
  .then(result => {
    if (result.error) {
      show_message(result.error, 'error');
    } else {
      show_message('Email sent successfully!', 'success');
    
      load_mailbox('sent');
    }
  })
  .catch(error => {
    show_message('An error occurred while sending the email.', 'error');
    console.error('Error:', error);
  });
}

function load_mailbox(mailbox) {
  // Show the mailbox and hide other views
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#compose-view').style.display = 'none';

  // Update active button state
  document.querySelectorAll('.nav-buttons .btn').forEach(b => b.classList.remove('active'));
  const activeButton = document.querySelector(`#${mailbox === 'archive' ? 'archived' : mailbox}`);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  // Show loading state
  document.querySelector('#emails-view').innerHTML = `
    <h3>📮 ${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>
    <div class="loading">Loading emails...</div>
  `;

  // Fetch emails from the API
  fetch(`/emails/${mailbox}`)
  .then(response => response.json())
  .then(emails => {
    display_emails(emails, mailbox);
  })
  .catch(error => {
    document.querySelector('#emails-view').innerHTML = `
      <h3>📮 ${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>
      <div class="message error">Error loading emails. Please try again.</div>
    `;
    console.error('Error:', error);
  });
}

function display_emails(emails, mailbox) {
  const emailsView = document.querySelector('#emails-view');
  
  if (emails.length === 0) {
    emailsView.innerHTML = `
      <h3>📮 ${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>
      <div class="message">No emails found.</div>
    `;
    return;
  }

  let emailsHTML = `<h3>📮 ${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;
  
  emails.forEach(email => {
    const readClass = email.read ? 'read' : 'unread';
    const emailPreview = email.body.length > 100 ? email.body.substring(0, 100) + '...' : email.body;
    
    emailsHTML += `
      <div class="email-item ${readClass}" onclick="view_email(${email.id}, '${mailbox}')">
        <div class="email-header">
          <span class="email-sender">${email.sender}</span>
          <span class="email-timestamp">${email.timestamp}</span>
        </div>
        <div class="email-subject">${email.subject || '(no subject)'}</div>
        <div class="email-preview">${emailPreview}</div>
      </div>
    `;
  });
  
  emailsView.innerHTML = emailsHTML;
}

function view_email(emailId, mailbox) {
  // Fetch the email details
  fetch(`/emails/${emailId}`)
  .then(response => response.json())
  .then(email => {
    display_email(email, mailbox);
    
    // Mark as read if it's in inbox
    if (mailbox === 'inbox' && !email.read) {
      mark_as_read(emailId);
    }
  })
  .catch(error => {
    show_message('Error loading email. Please try again.', 'error');
    console.error('Error:', error);
  });
}

function display_email(email, mailbox) {
  const emailsView = document.querySelector('#emails-view');
  
  let actionsHTML = '';
  if (mailbox !== 'sent') {
    const archiveText = email.archived ? 'Unarchive' : 'Archive';
    const archiveIcon = email.archived ? '📤' : '📁';
    actionsHTML = `
      <div class="email-actions">
        <button class="btn btn-primary" onclick="reply_email(${email.id})">↩️ Reply</button>
        <button class="btn ${email.archived ? 'btn-warning' : 'btn-success'}" onclick="toggle_archive(${email.id}, ${!email.archived}, '${mailbox}')">
          ${archiveIcon} ${archiveText}
        </button>
        <button class="btn btn-outline-primary" onclick="load_mailbox('${mailbox}')">← Back to ${mailbox}</button>
      </div>
    `;
  } else {
    actionsHTML = `
      <div class="email-actions">
        <button class="btn btn-outline-primary" onclick="load_mailbox('${mailbox}')">← Back to ${mailbox}</button>
      </div>
    `;
  }
  
  emailsView.innerHTML = `
    <div class="email-view">
      <div class="email-view-header">
        <div class="email-view-from"><strong>From:</strong> ${email.sender}</div>
        <div class="email-view-to"><strong>To:</strong> ${email.recipients.join(', ')}</div>
        <div class="email-view-subject"><strong>Subject:</strong> ${email.subject || '(no subject)'}</div>
        <div class="email-view-timestamp"><strong>Timestamp:</strong> ${email.timestamp}</div>
      </div>
      <div class="email-view-body">${email.body}</div>
      ${actionsHTML}
    </div>
  `;
}

function mark_as_read(emailId) {
  fetch(`/emails/${emailId}`, {
    method: 'PUT',
    body: JSON.stringify({
      read: true
    })
  });
}

function toggle_archive(emailId, archive, currentMailbox) {
  fetch(`/emails/${emailId}`, {
    method: 'PUT',
    body: JSON.stringify({
      archived: archive
    })
  })
  .then(() => {
    show_message(archive ? 'Email archived successfully!' : 'Email unarchived successfully!', 'success');
    load_mailbox('inbox');
  })
  .catch(error => {
    show_message('Error updating email. Please try again.', 'error');
    console.error('Error:', error);
  });
}

function reply_email(emailId) {
  fetch(`/emails/${emailId}`)
  .then(response => response.json())
  .then(email => {
    compose_email();
    
    // Pre-fill the compose form
    document.querySelector('#compose-recipients').value = email.sender;
    
    const subjectPrefix = email.subject.startsWith('Re: ') ? '' : 'Re: ';
    document.querySelector('#compose-subject').value = subjectPrefix + email.subject;
    
    const timestamp = new Date().toLocaleString();
    document.querySelector('#compose-body').value = `\n\n--- Original Message ---\nOn ${email.timestamp}, ${email.sender} wrote:\n${email.body}`;
  });
}

function show_message(message, type = 'info') {
  // Remove existing messages
  const existingMessages = document.querySelectorAll('.temp-message');
  existingMessages.forEach(msg => msg.remove());
  
  // Create new message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type} temp-message`;
  messageDiv.textContent = message;
  
  // Insert at the top of the container
  const container = document.querySelector('.container');
  container.insertBefore(messageDiv, container.firstChild);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}