import{b1 as d,j as e,B as t,b2 as o}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Feedback/Toast",component:d,tags:["autodocs"],args:{position:"bottom-right",closeButton:!1,expand:!1},argTypes:{position:{control:"select",options:["top-left","top-center","top-right","bottom-left","bottom-center","bottom-right"]}},decorators:[(s,l)=>e.jsxs(e.Fragment,{children:[e.jsx(s,{}),e.jsx(d,{...l.args})]})],parameters:{docs:{story:{inline:!1,iframeHeight:360},description:{component:'Short, transient feedback after an action. Mount `<Toaster />` once at the app root and\ncall `toast()` from anywhere: `toast.success`, `toast.error`, `toast.info`,\n`toast.warning`, `toast.loading`, `toast.promise`. Add `description` for a second line\nand `action: { label: "Undo", onClick }` for one follow-up action.'}}}},r={render:()=>e.jsx(t,{onClick:()=>o("Issue ENG-142 created"),children:"Show toast"})},i={render:()=>e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(t,{onClick:()=>o("Moved 3 issues to Cycle 43"),children:"Default"}),e.jsx(t,{onClick:()=>o.success("Project “Mobile app v2” created"),children:"Success"}),e.jsx(t,{onClick:()=>o.error("Couldn’t sync with GitHub",{description:"The token for acme/web expired. Reconnect in Settings."}),children:"Error"}),e.jsx(t,{onClick:()=>o.info("Tereza assigned ENG-142 to you"),children:"Info"}),e.jsx(t,{onClick:()=>o.warning("Cycle 42 ends tomorrow",{description:"7 issues are not done yet."}),children:"Warning"}),e.jsx(t,{onClick:()=>o.loading("Importing 240 issues from Jira…"),children:"Loading"}),e.jsx(t,{variant:"ghost",onClick:()=>o.dismiss(),children:"Dismiss all"})]})},a={render:()=>e.jsx(t,{onClick:()=>o("Issue deleted",{description:"ENG-131 Dark mode: chart tooltips are unreadable",action:{label:"Undo",onClick:()=>o.success("Issue restored")}}),children:"Delete issue"})},c={name:"Promise",render:()=>e.jsxs("div",{className:"flex gap-2",children:[e.jsx(t,{onClick:()=>o.promise(new Promise(s=>setTimeout(s,1500)),{loading:"Publishing project update…",success:"Update published to #mobile",error:"Couldn’t publish the update"}),children:"Resolves"}),e.jsx(t,{onClick:()=>o.promise(new Promise((s,l)=>setTimeout(()=>l(new Error("Network error")),1500)),{loading:"Exporting issues to CSV…",success:"Export ready",error:s=>`Export failed: ${s.message}`}),children:"Rejects"})]})},n={args:{closeButton:!0},render:()=>e.jsx(t,{onClick:()=>o.info("Notifications paused until 9:00"),children:"Show toast"})},g=["Playground","Types","WithAction","PromiseToast","WithCloseButton"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <Button onClick={() => toast("Issue ENG-142 created")}>Show toast</Button>
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast("Moved 3 issues to Cycle 43")}>
        Default
      </Button>
      <Button onClick={() => toast.success("Project “Mobile app v2” created")}>
        Success
      </Button>
      <Button onClick={() => toast.error("Couldn’t sync with GitHub", {
      description: "The token for acme/web expired. Reconnect in Settings."
    })}>
        Error
      </Button>
      <Button onClick={() => toast.info("Tereza assigned ENG-142 to you")}>
        Info
      </Button>
      <Button onClick={() => toast.warning("Cycle 42 ends tomorrow", {
      description: "7 issues are not done yet."
    })}>
        Warning
      </Button>
      <Button onClick={() => toast.loading("Importing 240 issues from Jira…")}>
        Loading
      </Button>
      <Button variant="ghost" onClick={() => toast.dismiss()}>
        Dismiss all
      </Button>
    </div>
}`,...i.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Button onClick={() => toast("Issue deleted", {
    description: "ENG-131 Dark mode: chart tooltips are unreadable",
    action: {
      label: "Undo",
      onClick: () => toast.success("Issue restored")
    }
  })}>
      Delete issue
    </Button>
}`,...a.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Promise",
  render: () => <div className="flex gap-2">
      <Button onClick={() => toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
      loading: "Publishing project update…",
      success: "Update published to #mobile",
      error: "Couldn’t publish the update"
    })}>
        Resolves
      </Button>
      <Button onClick={() => toast.promise(new Promise((_, reject) => setTimeout(() => reject(new Error("Network error")), 1500)), {
      loading: "Exporting issues to CSV…",
      success: "Export ready",
      error: (error: Error) => \`Export failed: \${error.message}\`
    })}>
        Rejects
      </Button>
    </div>
}`,...c.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    closeButton: true
  },
  render: () => <Button onClick={() => toast.info("Notifications paused until 9:00")}>
      Show toast
    </Button>
}`,...n.parameters?.docs?.source},description:{story:"`closeButton` shows a × on hover.",...n.parameters?.docs?.description}}};export{r as Playground,c as PromiseToast,i as Types,a as WithAction,n as WithCloseButton,g as __namedExportsOrder,m as default};
