import{bB as x,j as o,bC as h,r as f,bD as w}from"./iframe-BjN4PNZi.js";import{p as a}from"./fixtures-CW67wZDI.js";import"./preload-helper-PPVm8Dsz.js";import"./circle-dashed-Divtlg0F.js";import"./signal-high-Dzb6_NUQ.js";import"./tag-D81nTkkR.js";import"./settings-ULeVwmos.js";import"./user-plus-DQ5D-oOB.js";import"./inbox-CXA9en-m.js";import"./layers-syhRhF9-.js";import"./copy-DjBACZ_m.js";const E={title:"Patterns/CommentThread",component:x,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`An issue's discussion: comments with reactions, and a composer with an auto-growing
textarea, attach and send buttons. ⌘↵ (Ctrl+↵) sends.`}}},args:{comments:[]},argTypes:{comments:{control:!1},composer:{control:!1}}},u=s=>new Date(Date.now()-s*6e4),C=[{id:"c1",author:a.ben,createdAt:u(1560),body:"Repro'd on Outlook web: the link is opened by Safe Links before the user clicks it, so the one-time token is already spent.",reactions:[{emoji:"👀",count:2,people:["Ada Novak","Dan Whitfield"]}]},{id:"c2",author:a.ada,createdAt:u(95),body:"Plan: make the GET land on a confirm page and only consume the token on POST. Same flow for password reset.",edited:!0,reactions:[{emoji:"👍",count:3,reacted:!0,people:["You","Ben Okafor","Eva Lindqvist"]},{emoji:"🚀",count:1,people:["Chloé Martin"]}]},{id:"c3",author:a.chloe,createdAt:u(12),body:"I'll mock the confirm page today. Keep it to one button?"}];function b(s,p,n){return s.map(t=>{if(t.id!==p)return t;const e=[...t.reactions??[]],m=e.findIndex(g=>g.emoji===n),r=e[m];return r?e[m]={...r,reacted:!r.reacted,count:r.count+(r.reacted?-1:1)}:e.push({emoji:n,count:1,reacted:!0,people:["You"]}),{...t,reactions:e}})}const c={render:function(){const[p,n]=f.useState(C);return o.jsx("div",{className:"max-w-2xl",children:o.jsx(x,{comments:p,onReact:(t,e)=>n(m=>b(m,t,e)),composer:o.jsx(h,{author:a.ada,onAttach:()=>{},onSubmit:async t=>{await new Promise(e=>setTimeout(e,400)),n(e=>[...e,{id:`c${e.length+1}`,author:a.ada,createdAt:new Date,body:t}])}})})})}},i={render:()=>o.jsx("div",{className:"max-w-2xl",children:o.jsx(h,{author:a.ada,onAttach:()=>{},defaultValue:"Shipped behind the `confirm-magic-link` flag.\nRolling out to 10% tomorrow."})})},d={render:()=>o.jsx("div",{className:"max-w-2xl",children:o.jsx(h,{author:a.ada,disabled:!0,placeholder:"Comments are locked on canceled issues"})})},l={render:()=>o.jsx("div",{className:"max-w-2xl",children:o.jsx(w,{comment:C[1],onReact:()=>{}})})},B=["Playground","Composer","ComposerDisabled","SingleComment"];c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [comments, setComments] = useState(initialComments);
    return <div className="max-w-2xl">
        <CommentThread comments={comments} onReact={(id, emoji) => setComments(all => toggleReaction(all, id, emoji))} composer={<CommentComposer author={people.ada} onAttach={() => {}} onSubmit={async body => {
        await new Promise(r => setTimeout(r, 400));
        setComments(all => [...all, {
          id: \`c\${all.length + 1}\`,
          author: people.ada,
          createdAt: new Date(),
          body
        }]);
      }} />} />
      </div>;
  }
}`,...c.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="max-w-2xl">
      <CommentComposer author={people.ada} onAttach={() => {}} defaultValue={"Shipped behind the \`confirm-magic-link\` flag.\\nRolling out to 10% tomorrow."} />
    </div>
}`,...i.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="max-w-2xl">
      <CommentComposer author={people.ada} disabled placeholder="Comments are locked on canceled issues" />
    </div>
}`,...d.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="max-w-2xl">
      <CommentItem comment={initialComments[1] as CommentData} onReact={() => {}} />
    </div>
}`,...l.parameters?.docs?.source}}};export{i as Composer,d as ComposerDisabled,c as Playground,l as SingleComment,B as __namedExportsOrder,E as default};
