import{aI as i,j as e,aJ as h,aK as c,B as t,aL as d,aM as x,aN as g,aO as m,aP as j,aQ as u,aR as p}from"./iframe-BjN4PNZi.js";import{C as y}from"./circle-dot-1Hdi-o4t.js";import{S as C}from"./signal-high-Dzb6_NUQ.js";import{C as N}from"./circle-user-ILjuPnhn.js";import{T as v}from"./tag-D81nTkkR.js";import{L as b}from"./link-2-EvoKAGAX.js";import"./preload-helper-PPVm8Dsz.js";const I={title:"Overlays/Sheet",component:i,tags:["autodocs"],args:{side:"right",size:"md",showClose:!0},argTypes:{side:{control:"inline-radio",options:["right","left","bottom"]},size:{control:"inline-radio",options:["sm","md","lg","xl"]}},render:s=>e.jsxs(h,{children:[e.jsx(c,{asChild:!0,children:e.jsx(t,{children:"Open filters"})}),e.jsxs(i,{...s,children:[e.jsxs(d,{children:[e.jsx(x,{children:"Filters"}),e.jsx(g,{children:"Narrow down the issues in this view."})]}),e.jsx(m,{className:"text-fg-muted",children:"Status, assignee, label and project filters go here."}),e.jsxs(u,{children:[e.jsx(p,{asChild:!0,children:e.jsx(t,{variant:"ghost",children:"Reset"})}),e.jsx(p,{asChild:!0,children:e.jsx(t,{variant:"primary",children:"Apply"})})]})]})]}),parameters:{docs:{description:{component:"A side panel for details that keep the list underneath in context: an issue, a person,\nfilters. Slides in from the `right` (default), `left` or `bottom`; sizes `sm` to `xl`."}}}},P={docs:{story:{inline:!1,iframeHeight:600}}},a={},o={render:()=>e.jsx("div",{className:"flex gap-2",children:["right","left","bottom"].map(s=>e.jsxs(h,{children:[e.jsx(c,{asChild:!0,children:e.jsxs(t,{children:["From ",s]})}),e.jsxs(i,{side:s,size:"sm",children:[e.jsx(d,{children:e.jsxs(x,{children:["From the ",s]})}),e.jsx(m,{className:"text-fg-muted",children:"Panel content."})]})]},s))})},l={render:()=>e.jsx("div",{className:"flex gap-2",children:["sm","md","lg","xl"].map(s=>e.jsxs(h,{children:[e.jsx(c,{asChild:!0,children:e.jsx(t,{children:s})}),e.jsxs(i,{size:s,children:[e.jsx(d,{children:e.jsxs(x,{children:["Size “",s,"”"]})}),e.jsx(m,{className:"text-fg-muted",children:"Panel content."})]})]},s))})};function r({icon:s,label:S,children:f}){return e.jsxs("div",{className:"flex h-8 items-center gap-3",children:[e.jsxs("span",{className:"flex w-24 items-center gap-2 text-xs text-fg-subtle [&_svg]:size-4",children:[s,S]}),e.jsx("span",{className:"text-sm text-fg",children:f})]})}const n={parameters:P,render:()=>e.jsxs(h,{defaultOpen:!0,children:[e.jsx(c,{asChild:!0,children:e.jsx(t,{children:"ENG-142"})}),e.jsxs(i,{size:"lg",children:[e.jsxs(d,{children:[e.jsx("span",{className:"text-xs text-fg-subtle",children:"ENG-142"}),e.jsx(x,{children:"Login redirect loops when the session cookie expires"}),e.jsx(g,{className:"sr-only",children:"Issue details"})]}),e.jsxs(m,{className:"flex flex-col gap-6",children:[e.jsxs("div",{className:"flex flex-col",children:[e.jsx(r,{icon:e.jsx(y,{}),label:"Status",children:"In Progress"}),e.jsx(r,{icon:e.jsx(C,{}),label:"Priority",children:"High"}),e.jsx(r,{icon:e.jsx(N,{}),label:"Assignee",children:"Tereza Nováková"}),e.jsx(r,{icon:e.jsx(v,{}),label:"Labels",children:"Bug, Auth"}),e.jsx(r,{icon:e.jsx(j,{}),label:"Due",children:"Nov 4"})]}),e.jsxs("div",{className:"flex flex-col gap-2 text-sm leading-6 text-fg-muted",children:[e.jsx("p",{children:"After the session cookie expires, visiting any page sends the user to /login, which redirects back to the page because the refresh token is still valid. The browser stops after 20 redirects."}),e.jsx("p",{children:"Expected: refresh the session once, then render the page. If the refresh fails, show the login form."})]})]}),e.jsxs(u,{children:[e.jsx(t,{variant:"ghost",size:"sm",icon:e.jsx(b,{}),className:"mr-auto",children:"Copy link"}),e.jsx(p,{asChild:!0,children:e.jsx(t,{size:"sm",children:"Close"})})]})]})]})},E=["Playground","Sides","Sizes","IssueDetail"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex gap-2">
      {(["right", "left", "bottom"] as const).map(side => <Sheet key={side}>
          <SheetTrigger asChild>
            <Button>From {side}</Button>
          </SheetTrigger>
          <SheetContent side={side} size="sm">
            <SheetHeader>
              <SheetTitle>From the {side}</SheetTitle>
            </SheetHeader>
            <SheetBody className="text-fg-muted">Panel content.</SheetBody>
          </SheetContent>
        </Sheet>)}
    </div>
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex gap-2">
      {(["sm", "md", "lg", "xl"] as const).map(size => <Sheet key={size}>
          <SheetTrigger asChild>
            <Button>{size}</Button>
          </SheetTrigger>
          <SheetContent size={size}>
            <SheetHeader>
              <SheetTitle>Size “{size}”</SheetTitle>
            </SheetHeader>
            <SheetBody className="text-fg-muted">Panel content.</SheetBody>
          </SheetContent>
        </Sheet>)}
    </div>
}`,...l.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: openInFrame,
  render: () => <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button>ENG-142</Button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <span className="text-xs text-fg-subtle">ENG-142</span>
          <SheetTitle>
            Login redirect loops when the session cookie expires
          </SheetTitle>
          <SheetDescription className="sr-only">Issue details</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <div className="flex flex-col">
            <Property icon={<CircleDot />} label="Status">
              In Progress
            </Property>
            <Property icon={<SignalHigh />} label="Priority">
              High
            </Property>
            <Property icon={<UserCircle />} label="Assignee">
              Tereza Nováková
            </Property>
            <Property icon={<Tag />} label="Labels">
              Bug, Auth
            </Property>
            <Property icon={<CalendarDays />} label="Due">
              Nov 4
            </Property>
          </div>
          <div className="flex flex-col gap-2 text-sm leading-6 text-fg-muted">
            <p>
              After the session cookie expires, visiting any page sends the user
              to /login, which redirects back to the page because the refresh
              token is still valid. The browser stops after 20 redirects.
            </p>
            <p>
              Expected: refresh the session once, then render the page. If the
              refresh fails, show the login form.
            </p>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="ghost" size="sm" icon={<Link2 />} className="mr-auto">
            Copy link
          </Button>
          <SheetClose asChild>
            <Button size="sm">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
}`,...n.parameters?.docs?.source},description:{story:"Issue details pane, open by default.",...n.parameters?.docs?.description}}};export{n as IssueDetail,a as Playground,o as Sides,l as Sizes,E as __namedExportsOrder,I as default};
