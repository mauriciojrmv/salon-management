# Project Rules - Beauty Salon SaaS

## Principles

* Simplicity over complexity
* Mobile-first design
* Real-world usability over theoretical perfection
* Fast interactions (<2s)

## Architecture

* Use clean architecture
* Separate UI, logic, and data layers
* Use reusable components

## Code Style

* Use TypeScript strictly
* Avoid any
* Use clear naming conventions
* Keep functions small and readable

## UX Rules

* Minimize user input
* Prefer buttons over typing
* Avoid complex forms
* Optimize for non-technical users

## Business Logic Rules

* Always support multi-service sessions
* Services can be added dynamically
* Staff assignment per service (not per session)
* Material usage must be tied to a service

## Inventory Rules

* Do not overcomplicate precision
* Support approximate usage when needed
* Always calculate cost automatically

## Error Handling

* Allow edits after completion
* Never block user workflow
* Log important actions

## Performance

* Optimize Firestore queries
* Avoid unnecessary re-renders
* Lazy load when possible

## Future Ready

* Multi-tenant architecture
* Role-based permissions
* API-ready structure

## Important

This system must feel easier than WhatsApp and paper tracking.
