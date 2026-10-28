import{a6 as y,c6 as t,j as e,c7 as o,c8 as i,c9 as s,bq as A}from"./iframe-BjN4PNZi.js";import{B as h}from"./bell-CVea3eBz.js";import{K as b}from"./key-round-BgM91_-8.js";import"./preload-helper-PPVm8Dsz.js";const m={name:"webhook",size:24,node:[["path",{d:"M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2",key:"q3hayz"}],["path",{d:"m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06",key:"1go1hn"}],["path",{d:"m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8",key:"qlwsc0"}]]};m.node;const x=y(m),C={title:"Data display/Accordion",component:t,tags:["autodocs"],args:{type:"single",collapsible:!0},argTypes:{type:{control:"inline-radio",options:["single","multiple"]}},decorators:[n=>e.jsx("div",{className:"w-[480px]",children:e.jsx(n,{})})],parameters:{docs:{description:{component:'Collapsible sections with a subtle rotating chevron. `type="single"` keeps one section\nopen (add `collapsible` to allow closing it), `type="multiple"` lets several stay open.'}}}},p=[{value:"cycles",title:"How do cycles work?",body:"Cycles are time-boxed iterations, usually one or two weeks. Unfinished issues roll over to the next cycle automatically."},{value:"triage",title:"Who sees the triage inbox?",body:"Everyone on the team. Issues created by integrations or people outside the team land there first."},{value:"estimates",title:"Can we use t-shirt sizes for estimates?",body:"Yes. Choose between exponential, fibonacci, linear and t-shirt scales in the team settings."}],c={render:({type:n,collapsible:g})=>{const u=p.map(r=>e.jsxs(o,{value:r.value,children:[e.jsx(i,{children:r.title}),e.jsx(s,{children:r.body})]},r.value));return n==="single"?e.jsx(t,{type:"single",collapsible:g,defaultValue:"cycles",children:u}):e.jsx(t,{type:"multiple",defaultValue:["cycles"],children:u})}},a={render:()=>e.jsx(t,{type:"multiple",defaultValue:["cycles","estimates"],children:p.map(n=>e.jsxs(o,{value:n.value,children:[e.jsx(i,{children:n.title}),e.jsx(s,{children:n.body})]},n.value))})},l={render:()=>e.jsxs(t,{type:"single",collapsible:!0,children:[e.jsxs(o,{value:"a",children:[e.jsx(i,{children:"Available section"}),e.jsx(s,{children:"Content."})]}),e.jsxs(o,{value:"b",disabled:!0,children:[e.jsx(i,{trailing:"Business plan",children:"Audit log streaming"}),e.jsx(s,{children:"Content."})]})]})},d={render:()=>e.jsx("div",{className:"rounded-lg border border-line bg-surface-raised px-4",children:e.jsxs(t,{type:"multiple",defaultValue:["notifications"],children:[e.jsxs(o,{value:"notifications",children:[e.jsx(i,{icon:e.jsx(h,{}),trailing:"3 enabled",children:"Notifications"}),e.jsx(s,{children:"Email for assignments and mentions, desktop push for comments on issues you are subscribed to, and a weekly digest on Monday."})]}),e.jsxs(o,{value:"api",children:[e.jsx(i,{icon:e.jsx(b,{}),trailing:e.jsx(A,{size:"sm",children:"2 keys"}),children:"API keys"}),e.jsx(s,{children:"Personal API keys act as you. Revoke keys you no longer use."})]}),e.jsxs(o,{value:"webhooks",children:[e.jsx(i,{icon:e.jsx(x,{}),trailing:"None",children:"Webhooks"}),e.jsx(s,{children:"Send issue and comment events to your own endpoint."})]})]})})},I=["Playground","Multiple","Disabled","SettingsSections"];c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: ({
    type,
    collapsible
  }) => {
    const items = faq.map(item => <AccordionItem key={item.value} value={item.value}>
        <AccordionTrigger>{item.title}</AccordionTrigger>
        <AccordionContent>{item.body}</AccordionContent>
      </AccordionItem>);
    return type === "single" ? <Accordion type="single" collapsible={collapsible} defaultValue="cycles">
        {items}
      </Accordion> : <Accordion type="multiple" defaultValue={["cycles"]}>
        {items}
      </Accordion>;
  }
}`,...c.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Accordion type="multiple" defaultValue={["cycles", "estimates"]}>
      {faq.map(item => <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>{item.body}</AccordionContent>
        </AccordionItem>)}
    </Accordion>
}`,...a.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <Accordion type="single" collapsible>
      <AccordionItem value="a">
        <AccordionTrigger>Available section</AccordionTrigger>
        <AccordionContent>Content.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b" disabled>
        <AccordionTrigger trailing="Business plan">
          Audit log streaming
        </AccordionTrigger>
        <AccordionContent>Content.</AccordionContent>
      </AccordionItem>
    </Accordion>
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="rounded-lg border border-line bg-surface-raised px-4">
      <Accordion type="multiple" defaultValue={["notifications"]}>
        <AccordionItem value="notifications">
          <AccordionTrigger icon={<Bell />} trailing="3 enabled">
            Notifications
          </AccordionTrigger>
          <AccordionContent>
            Email for assignments and mentions, desktop push for comments on
            issues you are subscribed to, and a weekly digest on Monday.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="api">
          <AccordionTrigger icon={<KeyRound />} trailing={<Badge size="sm">2 keys</Badge>}>
            API keys
          </AccordionTrigger>
          <AccordionContent>
            Personal API keys act as you. Revoke keys you no longer use.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="webhooks">
          <AccordionTrigger icon={<Webhook />} trailing="None">
            Webhooks
          </AccordionTrigger>
          <AccordionContent>
            Send issue and comment events to your own endpoint.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
}`,...d.parameters?.docs?.source}}};export{l as Disabled,a as Multiple,c as Playground,d as SettingsSections,I as __namedExportsOrder,C as default};
