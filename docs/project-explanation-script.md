# ReVive Presentation Script — Two Speakers

*Bracketed directions guide the screen recording and are not spoken.*

## About the project and live walkthrough

**Speaker 1:** Hello, we’re presenting **ReVive — Turn waste into worth.** ReVive connects residents who want to recycle with delivery partners who collect materials, recycling centers that receive and verify them, and administrators who oversee the service. We’ll start on the homepage and follow a pickup through the full process, from sign-in to verified recycling and rewards.

**[On screen: Start on the homepage. Point out the service overview and the calls to action. Click Login and sign in to a registered resident account.]**

**Speaker 2:** The homepage introduces the service and lets people choose where to go next. After signing in, a resident arrives at a dashboard with their pickup and recycling activity. The graphs summarize recorded recycling activity and material categories, so residents can see the impact of their completed activity at a glance.

**[On screen: Briefly point to the resident dashboard’s activity graph and category chart. Then open Schedule Pickup.]**

**Speaker 1:** To arrange a collection, the resident chooses a material, enters an estimated quantity and a convenient time, and sets the pickup address. They can place or adjust a pin on the map so the location has coordinates. ReVive uses that pickup pin and the saved center locations to find centers that accept the material and compare driving-route distances. The route distance is useful when choosing a center; if road routing or a required pin is unavailable, the page explains that the distance cannot be shown.

**[On screen: Set the pickup pin, show the eligible center recommendations and their driving distances, select a center, and submit the request. Open My Pickups and show the new request and tracking timeline.]**

**Speaker 2:** After the resident submits, the pickup appears in their list with its status timeline. The request then becomes available to a delivery partner. The timeline makes it possible to follow the same pickup as it moves through the workflow.

**[On screen: Sign out, sign in to an approved delivery partner account, and open Jobs. Show the pickup address, selected center, and route distance details. Accept the job, then demonstrate the available collection and delivery status updates. Show delivery history.]**

**Speaker 1:** The delivery partner can see where to collect the material and where to take it. The route figures show the partner’s base to the pickup, the pickup to the center, and the complete driving route when route data is available. After accepting, the partner updates the job as it is collected and delivered. Their completed delivery records are kept in the delivery view.

**[On screen: Sign out, sign in to an approved recycling center account, and open incoming deliveries. Select the delivered pickup, enter the actual received weight, and verify the recycling.]**

**Speaker 2:** At the center, staff confirm what arrived and record the actual weight. That verification is important because rewards and delivery earnings are based on verified work, rather than only on a resident’s estimate when requesting a pickup.

**[On screen: Sign in to the resident account again. Show the updated points and reward history, then open Rewards and show an available coupon or redemption if the account has enough points.]**

**Speaker 1:** Once the center verifies the pickup, the resident can see the resulting points in Rewards. If an active coupon is available and the resident has enough points, they can redeem it; the application records the redemption and points change.

**[On screen: Sign in as an administrator. Show the dashboard graphs, then the relevant account or center approvals, pickup oversight, and coupon management pages.]**

**Speaker 2:** Administrators oversee the shared service. They review accounts and center applications, monitor pickups, and manage reward coupons. The admin dashboard graphs summarize the recycling activity recorded in the system. In particular, verified pickup weights feed the recycling totals and material-category breakdown, which helps the admin see what has actually been processed. The map and graph views present information from saved locations and recorded pickup data; they are there to support operational decisions, not just decoration.

## Tech stack and schema

**[On screen: Return briefly to the map, then show the resident and admin charts.]**

**Speaker 1:** The frontend is built with React and Vite. React Router supports the role-specific pages, Tailwind CSS is used for styling, and Recharts renders the dashboard graphs. The map layer is a major feature of the product: Leaflet with OpenStreetMap displays pickup pins and center locations, while OSRM and Mapbox can provide route and address data when available. These map features help residents choose a collection point and let delivery partners plan a route.

**Speaker 2:** The database schema is built around DynamoDB as the main NoSQL data store. Core records are split across users, pickups, rewards, and coupons, with each item linked by IDs so the app can retrieve a resident’s history, a delivery job, or a verified recycling record efficiently. For local development, DynamoDB Local mirrors the same structure so the system can be tested before deployment.

## How AWS is used

**[On screen: Briefly show the AWS SAM template, then return to the running local application.]**

**Speaker 1:** The schema follows a simple but scalable NoSQL pattern. Users, pickups, centers, coupons, and reward activity are stored as separate records with shared keys, so the system can track both the operational flow and the user-facing history without mixing responsibilities across entities. The backend API reads and writes these records through structured actions, keeping the logic consistent across residents, delivery partners, and centers.

**Speaker 2:** The map experience is just as important to the product as the database schema: route planning and pickup-center selection rely on saved coordinates, center metadata, and route calculations. This project has not been deployed to AWS, and staging resources have not been created, so our demo uses the local API and DynamoDB Local to show the same workflow without production authentication.

## Learning and growth

**Speaker 1:** ReVive taught us how to design a connected recycling ecosystem across residents, delivery partners, centers, and admins, while keeping every status change clear and trustworthy. We also learned how important the core platform pieces are: DynamoDB and Lambda for storing and processing operational data, and maps for route planning and center selection. This helped us connect the product workflow to real-world logistics while still separating local demo flows from deployed cloud services.
