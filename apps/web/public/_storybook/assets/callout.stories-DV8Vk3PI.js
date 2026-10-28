import{a6 as f,c4 as n,j as e,c5 as u,B as d,r as y,C as x,e as C,f as b,m as v}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const m={name:"refresh-cw",size:24,node:[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]};m.node;const j=f(m),w={title:"Feedback/Banner",component:n,tags:["autodocs"],args:{tone:"info",title:"Cycles start on Monday",description:"Issues not finished by Sunday move to the next cycle automatically."},argTypes:{tone:{control:"inline-radio",options:["info","success","warning","danger","neutral"]}},decorators:[t=>e.jsx("div",{className:"w-[32rem]",children:e.jsx(t,{})})],parameters:{docs:{description:{component:"Persistent messages. `Callout` is a box inside content (an explanation, a warning\nbefore a risky setting); `Banner` is a full-width strip at the top of a page or panel\n(a trial ending, a failed sync). Tones: info, success, warning, danger, neutral. Both\ntake a title, a description, actions and `onDismiss`."}}}},a={},i={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(n,{tone:"info",title:"Cycles start on Monday"}),e.jsx(n,{tone:"success",title:"GitHub connected",children:"Pull requests now link to issues by branch name."}),e.jsx(n,{tone:"warning",title:"3 issues have no estimate",children:"The cycle’s scope can’t be calculated until every issue is estimated."}),e.jsx(n,{tone:"danger",title:"Sync failed",children:"We couldn’t reach Jira. Imported issues may be out of date."}),e.jsx(n,{tone:"neutral",title:"Keyboard first",children:"Press ? to see every shortcut."})]})},r={args:{title:void 0,icon:!1}},o={args:{tone:"warning",title:"Your GitHub token expires in 3 days",description:"Reconnect to keep pull requests linked to issues.",actions:e.jsxs(e.Fragment,{children:[e.jsx(d,{size:"xs",icon:e.jsx(j,{}),children:"Reconnect"}),e.jsx(d,{size:"xs",variant:"ghost",children:"Remind me later"})]})}},c={render:function(g){const[h,p]=y.useState(!0);return h?e.jsx(n,{...g,onDismiss:()=>p(!1)}):e.jsx(d,{size:"sm",onClick:()=>p(!0),children:"Show again"})}},l={decorators:[t=>e.jsx("div",{className:"w-[48rem]",children:e.jsx(t,{})})],render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(u,{tone:"info",title:"Your trial ends in 5 days.",description:"Upgrade to keep unlimited issues and cycles.",actions:e.jsx(d,{size:"xs",variant:"primary",children:"Upgrade"}),onDismiss:()=>{}}),e.jsx(u,{tone:"danger",description:"Slack notifications are failing. Reconnect Slack in Settings."}),e.jsx(u,{tone:"neutral",description:"Scheduled maintenance on Sunday, 02:00–02:30 UTC."})]})},s={render:()=>e.jsxs(x,{children:[e.jsxs(C,{children:[e.jsx(b,{children:"Public issue submission"}),e.jsx(v,{children:"Anyone with the link can file issues into the Triage queue."})]}),e.jsx(n,{className:"mt-4",tone:"warning",title:"Spam protection is off",description:"Turn on Turnstile before sharing the link publicly."})]})},B=["Playground","Tones","DescriptionOnly","WithActions","Dismissible","Banners","InContext"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Callout tone="info" title="Cycles start on Monday" />
      <Callout tone="success" title="GitHub connected">
        Pull requests now link to issues by branch name.
      </Callout>
      <Callout tone="warning" title="3 issues have no estimate">
        The cycle’s scope can’t be calculated until every issue is estimated.
      </Callout>
      <Callout tone="danger" title="Sync failed">
        We couldn’t reach Jira. Imported issues may be out of date.
      </Callout>
      <Callout tone="neutral" title="Keyboard first">
        Press ? to see every shortcut.
      </Callout>
    </div>
}`,...i.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    title: undefined,
    icon: false
  }
}`,...r.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    tone: "warning",
    title: "Your GitHub token expires in 3 days",
    description: "Reconnect to keep pull requests linked to issues.",
    actions: <>
        <Button size="xs" icon={<RefreshCw />}>
          Reconnect
        </Button>
        <Button size="xs" variant="ghost">
          Remind me later
        </Button>
      </>
  }
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [visible, setVisible] = useState(true);
    return visible ? <Callout {...args} onDismiss={() => setVisible(false)} /> : <Button size="sm" onClick={() => setVisible(true)}>
        Show again
      </Button>;
  }
}`,...c.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <div className="w-[48rem]">
        <Story />
      </div>],
  render: () => <div className="flex flex-col gap-3">
      <Banner tone="info" title="Your trial ends in 5 days." description="Upgrade to keep unlimited issues and cycles." actions={<Button size="xs" variant="primary">
            Upgrade
          </Button>} onDismiss={() => {}} />
      <Banner tone="danger" description="Slack notifications are failing. Reconnect Slack in Settings." />
      <Banner tone="neutral" description="Scheduled maintenance on Sunday, 02:00–02:30 UTC." />
    </div>
}`,...l.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader>
        <CardTitle>Public issue submission</CardTitle>
        <CardDescription>
          Anyone with the link can file issues into the Triage queue.
        </CardDescription>
      </CardHeader>
      <Callout className="mt-4" tone="warning" title="Spam protection is off" description="Turn on Turnstile before sharing the link publicly." />
    </Card>
}`,...s.parameters?.docs?.source},description:{story:"A Callout inside a settings card, warning before a risky option.",...s.parameters?.docs?.description}}};export{l as Banners,r as DescriptionOnly,c as Dismissible,s as InContext,a as Playground,i as Tones,o as WithActions,B as __namedExportsOrder,w as default};
