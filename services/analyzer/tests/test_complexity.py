"""Evaluation cases: typical solutions with the complexity a careful reviewer would give.

Sizes get letters in the order the inputs appear: the first sized input is n, the next m (a
list's own length before its items' lengths); k is the number of different characters, h a
tree's height, V and E a graph's nodes and edges. Every misread solution reported by a person
becomes a case here, so a fix can't silently come undone.
"""

import textwrap

import pytest

from branch_analyzer import analyze

CASES = [
    (
        'contains duplicate, hash set',
        """
        class Solution:
            def hasDuplicate(self, nums: List[int]) -> bool:
                seen = set()
                for n in nums:
                    if n in seen:
                        return True
                    seen.add(n)
                return False
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'contains duplicate, set length',
        """
        class Solution:
            def hasDuplicate(self, nums):
                return len(set(nums)) < len(nums)
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'two sum, brute force',
        """
        class Solution:
            def twoSum(self, nums, target):
                for i in range(len(nums)):
                    for j in range(i + 1, len(nums)):
                        if nums[i] + nums[j] == target:
                            return [i, j]
        """,
        'O(n²)',
        'O(1)',
    ),
    (
        'two sum, hash map',
        """
        class Solution:
            def twoSum(self, nums, target):
                index = {}
                for i, n in enumerate(nums):
                    if target - n in index:
                        return [index[target - n], i]
                    index[n] = i
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'valid anagram, sorting',
        """
        class Solution:
            def isAnagram(self, s, t):
                return sorted(s) == sorted(t)
        """,
        'O(n log n)',
        'O(n)',
    ),
    (
        'valid anagram, counting into a fixed array',
        """
        class Solution:
            def isAnagram(self, s, t):
                if len(s) != len(t):
                    return False
                count = [0] * 26
                for i in range(len(s)):
                    count[ord(s[i]) - ord('a')] += 1
                    count[ord(t[i]) - ord('a')] -= 1
                return all(c == 0 for c in count)
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'group anagrams: sorting each word (k log k per word, counted as n)',
        """
        class Solution:
            def groupAnagrams(self, strs):
                groups = defaultdict(list)
                for s in strs:
                    groups[tuple(sorted(s))].append(s)
                return list(groups.values())
        """,
        'O(n·m log m)',
        'O(n·m)',
    ),
    (
        'binary search',
        """
        class Solution:
            def search(self, nums, target):
                l, r = 0, len(nums) - 1
                while l <= r:
                    m = (l + r) // 2
                    if nums[m] == target:
                        return m
                    if nums[m] < target:
                        l = m + 1
                    else:
                        r = m - 1
                return -1
        """,
        'O(log n)',
        'O(1)',
    ),
    (
        'two pointers',
        """
        class Solution:
            def isPalindrome(self, s):
                l, r = 0, len(s) - 1
                while l < r:
                    if s[l] != s[r]:
                        return False
                    l += 1
                    r -= 1
                return True
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'sliding window',
        """
        class Solution:
            def lengthOfLongestSubstring(self, s):
                seen = set()
                l = 0
                best = 0
                for r in range(len(s)):
                    while s[r] in seen:
                        seen.remove(s[l])
                        l += 1
                    seen.add(s[r])
                    best = max(best, r - l + 1)
                return best
        """,
        'O(n)',
        'O(k)',
    ),
    (
        'monotonic stack',
        """
        class Solution:
            def dailyTemperatures(self, temperatures):
                res = [0] * len(temperatures)
                stack = []
                for i, t in enumerate(temperatures):
                    while stack and t > stack[-1][0]:
                        _, j = stack.pop()
                        res[j] = i - j
                    stack.append((t, i))
                return res
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'top k frequent, heap',
        """
        class Solution:
            def topKFrequent(self, nums, k):
                count = Counter(nums)
                heap = []
                for n, c in count.items():
                    heapq.heappush(heap, (c, n))
                    if len(heap) > k:
                        heapq.heappop(heap)
                return [n for c, n in heap]
        """,
        'O(n log n)',
        'O(n)',
    ),
    (
        'maximum depth of a binary tree',
        """
        class Solution:
            def maxDepth(self, root):
                if not root:
                    return 0
                return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))
        """,
        'O(n)',
        'O(h)',
    ),
    (
        'climbing stairs, naive recursion',
        """
        class Solution:
            def climbStairs(self, n):
                def go(i):
                    if i >= n:
                        return i == n
                    return go(i + 1) + go(i + 2)
                return go(0)
        """,
        'O(2ⁿ)',
        'O(n)',
    ),
    (
        'climbing stairs, memoized',
        """
        class Solution:
            def climbStairs(self, n):
                @cache
                def go(i):
                    if i >= n:
                        return i == n
                    return go(i + 1) + go(i + 2)
                return go(0)
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'number of islands, flood fill',
        """
        class Solution:
            def numIslands(self, grid):
                rows, cols = len(grid), len(grid[0])
                def dfs(r, c):
                    if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] == "0":
                        return
                    grid[r][c] = "0"
                    dfs(r + 1, c)
                    dfs(r - 1, c)
                    dfs(r, c + 1)
                    dfs(r, c - 1)
                islands = 0
                for r in range(rows):
                    for c in range(cols):
                        if grid[r][c] == "1":
                            dfs(r, c)
                            islands += 1
                return islands
        """,
        'O(m·n)',
        'O(m·n)',
    ),
    (
        'subsets, backtracking',
        """
        class Solution:
            def subsets(self, nums):
                res, path = [], []
                def backtrack(i):
                    if i == len(nums):
                        res.append(path[:])
                        return
                    path.append(nums[i])
                    backtrack(i + 1)
                    path.pop()
                    backtrack(i + 1)
                backtrack(0)
                return res
        """,
        'O(n·2ⁿ)',
        'O(n·2ⁿ)',
    ),
    (
        'membership in an input list inside a loop',
        """
        class Solution:
            def intersection(self, nums1, nums2):
                return [x for x in nums1 if x in nums2]
        """,
        'O(n·m)',
        'O(1)',
    ),
    (
        '3sum: the pointers restart for each i, so it stays quadratic',
        """
        class Solution:
            def threeSum(self, nums):
                nums.sort()
                res = []
                for i in range(len(nums)):
                    l, r = i + 1, len(nums) - 1
                    while l < r:
                        total = nums[i] + nums[l] + nums[r]
                        if total < 0:
                            l += 1
                        elif total > 0:
                            r -= 1
                        else:
                            res.append([nums[i], nums[l], nums[r]])
                            l += 1
                            r -= 1
                return res
        """,
        'O(n²)',
        'O(n²)',
    ),
    (
        'merge intervals',
        """
        class Solution:
            def merge(self, intervals):
                intervals.sort(key=lambda i: i[0])
                out = [intervals[0]]
                for start, end in intervals[1:]:
                    if start <= out[-1][1]:
                        out[-1][1] = max(out[-1][1], end)
                    else:
                        out.append([start, end])
                return out
        """,
        'O(n log n)',
        'O(n)',
    ),
    (
        'reverse a linked list',
        """
        class Solution:
            def reverseList(self, head):
                prev, cur = None, head
                while cur:
                    nxt = cur.next
                    cur.next = prev
                    prev, cur = cur, nxt
                return prev
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'breadth-first search',
        """
        class Solution:
            def levelOrder(self, root):
                res = []
                q = deque([root] if root else [])
                while q:
                    level = []
                    for _ in range(len(q)):
                        node = q.popleft()
                        level.append(node.val)
                        if node.left:
                            q.append(node.left)
                        if node.right:
                            q.append(node.right)
                    res.append(level)
                return res
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'slicing inside a loop',
        """
        class Solution:
            def countPalindromes(self, s):
                count = 0
                for i in range(len(s)):
                    for j in range(i + 1, len(s) + 1):
                        if s[i:j] == s[i:j][::-1]:
                            count += 1
                return count
        """,
        'O(n³)',
        'O(n)',
    ),
    (
        'top k frequent, bucket sort',
        """
        class Solution:
            def topKFrequent(self, nums, k):
                count = {}
                freq = [[] for i in range(len(nums) + 1)]
                for n in nums:
                    count[n] = 1 + count.get(n, 0)
                for n, c in count.items():
                    freq[c].append(n)
                res = []
                for i in range(len(freq) - 1, 0, -1):
                    for n in freq[i]:
                        res.append(n)
                        if len(res) == k:
                            return res
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'course schedule, BFS over adjacency lists (n counts nodes and edges)',
        """
        class Solution:
            def canFinish(self, numCourses, prerequisites):
                adj = defaultdict(list)
                indeg = [0] * numCourses
                for a, b in prerequisites:
                    adj[b].append(a)
                    indeg[a] += 1
                q = deque([i for i in range(numCourses) if indeg[i] == 0])
                seen = 0
                while q:
                    node = q.popleft()
                    seen += 1
                    for nei in adj[node]:
                        indeg[nei] -= 1
                        if indeg[nei] == 0:
                            q.append(nei)
                return seen == numCourses
        """,
        'O(n + m)',
        'O(n + m)',
    ),
    (
        'coin change: loops over two inputs, shown as n² with less confidence',
        """
        class Solution:
            def coinChange(self, coins, amount):
                dp = [amount + 1] * (amount + 1)
                dp[0] = 0
                for a in range(1, amount + 1):
                    for c in coins:
                        if a - c >= 0:
                            dp[a] = min(dp[a], 1 + dp[a - c])
                return dp[amount] if dp[amount] != amount + 1 else -1
        """,
        'O(n·m)',
        'O(m)',
    ),
    (
        "longest consecutive sequence: the inner loop only runs from a sequence's start",
        """
        class Solution:
            def longestConsecutive(self, nums):
                numSet = set(nums)
                longest = 0
                for n in numSet:
                    if (n - 1) not in numSet:
                        length = 1
                        while (n + length) in numSet:
                            length += 1
                        longest = max(length, longest)
                return longest
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'minimum window substring',
        """
        class Solution:
            def minWindow(self, s, t):
                need = Counter(t)
                have = {}
                l = 0
                res, resLen = [-1, -1], float("inf")
                formed = 0
                for r in range(len(s)):
                    c = s[r]
                    have[c] = have.get(c, 0) + 1
                    if c in need and have[c] == need[c]:
                        formed += 1
                    while formed == len(need):
                        if r - l + 1 < resLen:
                            res, resLen = [l, r], r - l + 1
                        have[s[l]] -= 1
                        if s[l] in need and have[s[l]] < need[s[l]]:
                            formed -= 1
                        l += 1
                l, r = res
                return s[l:r + 1] if resLen != float("inf") else ""
        """,
        'O(n)',
        'O(n)',
    ),
    (
        "top k frequent, buckets built by appending (an owner's solution)",
        """
        class Solution:
            def topKFrequent(self, nums: list[int], k: int) -> list[int]:
                count = {}

                for num in nums:
                    count[num] = count.get(num, 0) + 1

                freq = []

                for _ in range(len(nums) + 1):
                    freq.append([])

                for num, counts in count.items():
                    freq[counts].append(num)

                res = []
                for i in range(len(freq) - 1, 0, -1):
                    for num in freq[i]:
                        res.append(num)

                        if len(res) == k:
                            return res
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'a grid filled in nested loops is n² items, not buckets',
        """
        class Solution:
            def total(self, n):
                grid = [[] for _ in range(n)]
                for r in range(n):
                    for c in range(n):
                        grid[r].append(r * c)
                s = 0
                for r in range(n):
                    for v in grid[r]:
                        s += v
                return s
        """,
        'O(n²)',
        'O(n²)',
    ),
    (
        'constant work',
        """
        class Solution:
            def addDigits(self, num):
                return 0 if num == 0 else 1 + (num - 1) % 9
        """,
        'O(1)',
        'O(1)',
    ),
    (
        'a plain function, not a class',
        """
        def missing_number(nums):
            return len(nums) * (len(nums) + 1) // 2 - sum(nums)
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'contains duplicate, sort',
        """
        class Solution:
            def containsDuplicate(self, nums: List[int]) -> bool:
                nums.sort()
                for i in range(1, len(nums)):
                    if nums[i] == nums[i - 1]:
                        return True
                return False
        """,
        'O(n log n)',
        'O(1)',
    ),
    (
        'valid anagram, Counter',
        """
        class Solution:
            def isAnagram(self, s: str, t: str) -> bool:
                return Counter(s) == Counter(t)
        """,
        'O(n)',
        'O(k)',
    ),
    (
        'valid anagram, counting with comprehensions (an owner\'s solution)',
        """
        class Solution:
            def isAnagram(self, s: str, t: str) -> bool:
                s_count = {c: s.count(c) for c in set(s)}
                t_count = {c: t.count(c) for c in set(t)}
                return s_count == t_count
        """,
        'O(n·k)',
        'O(k)',
    ),
    (
        'group anagrams, letter-count key',
        """
        class Solution:
            def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
                res = defaultdict(list)
                for s in strs:
                    count = [0] * 26
                    for c in s:
                        count[ord(c) - ord("a")] += 1
                    res[tuple(count)].append(s)
                return list(res.values())
        """,
        'O(n·m)',
        'O(n)',
    ),
    (
        'product of array except self',
        """
        class Solution:
            def productExceptSelf(self, nums: List[int]) -> List[int]:
                res = [1] * len(nums)
                prefix = 1
                for i in range(len(nums)):
                    res[i] = prefix
                    prefix *= nums[i]
                postfix = 1
                for i in range(len(nums) - 1, -1, -1):
                    res[i] *= postfix
                    postfix *= nums[i]
                return res
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'valid palindrome, two pointers',
        """
        class Solution:
            def isPalindrome(self, s: str) -> bool:
                l, r = 0, len(s) - 1
                while l < r:
                    while l < r and not s[l].isalnum():
                        l += 1
                    while r > l and not s[r].isalnum():
                        r -= 1
                    if s[l].lower() != s[r].lower():
                        return False
                    l, r = l + 1, r - 1
                return True
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'container with most water',
        """
        class Solution:
            def maxArea(self, heights: List[int]) -> int:
                l, r = 0, len(heights) - 1
                res = 0
                while l < r:
                    res = max(res, min(heights[l], heights[r]) * (r - l))
                    if heights[l] < heights[r]:
                        l += 1
                    else:
                        r -= 1
                return res
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'best time to buy and sell stock',
        """
        class Solution:
            def maxProfit(self, prices: List[int]) -> int:
                res = 0
                lowest = prices[0]
                for price in prices:
                    if price < lowest:
                        lowest = price
                    res = max(res, price - lowest)
                return res
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'longest repeating character replacement',
        """
        class Solution:
            def characterReplacement(self, s: str, k: int) -> int:
                count = {}
                res = 0
                l = 0
                for r in range(len(s)):
                    count[s[r]] = 1 + count.get(s[r], 0)
                    while (r - l + 1) - max(count.values()) > k:
                        count[s[l]] -= 1
                        l += 1
                    res = max(res, r - l + 1)
                return res
        """,
        'O(n·k)',
        'O(k)',
    ),
    (
        'permutation in string, sliding counts (compares counts each step)',
        """
        class Solution:
            def checkInclusion(self, s1: str, s2: str) -> bool:
                if len(s1) > len(s2):
                    return False
                need = Counter(s1)
                window = Counter()
                for i, c in enumerate(s2):
                    window[c] += 1
                    if i >= len(s1):
                        left = s2[i - len(s1)]
                        window[left] -= 1
                        if window[left] == 0:
                            del window[left]
                    if window == need:
                        return True
                return False
        """,
        'O(n·k)',
        'O(k)',
    ),
    (
        'valid parentheses',
        """
        class Solution:
            def isValid(self, s: str) -> bool:
                stack = []
                pairs = {")": "(", "]": "[", "}": "{"}
                for c in s:
                    if c in pairs:
                        if stack and stack[-1] == pairs[c]:
                            stack.pop()
                        else:
                            return False
                    else:
                        stack.append(c)
                return not stack
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'largest rectangle in histogram, monotonic stack',
        """
        class Solution:
            def largestRectangleArea(self, heights: List[int]) -> int:
                maxArea = 0
                stack = []
                for i, h in enumerate(heights):
                    start = i
                    while stack and stack[-1][1] > h:
                        index, height = stack.pop()
                        maxArea = max(maxArea, height * (i - index))
                        start = index
                    stack.append((start, h))
                for i, h in stack:
                    maxArea = max(maxArea, h * (len(heights) - i))
                return maxArea
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'search a 2D matrix, binary search',
        """
        class Solution:
            def searchMatrix(self, matrix: List[List[int]], target: int) -> bool:
                rows, cols = len(matrix), len(matrix[0])
                l, r = 0, rows * cols - 1
                while l <= r:
                    m = (l + r) // 2
                    value = matrix[m // cols][m % cols]
                    if value == target:
                        return True
                    if value < target:
                        l = m + 1
                    else:
                        r = m - 1
                return False
        """,
        'O(log m + log n)',
        'O(1)',
    ),
    (
        'koko eating bananas',
        """
        class Solution:
            def minEatingSpeed(self, piles: List[int], h: int) -> int:
                l, r = 1, max(piles)
                res = r
                while l <= r:
                    k = (l + r) // 2
                    hours = 0
                    for p in piles:
                        hours += math.ceil(p / k)
                    if hours <= h:
                        res = k
                        r = k - 1
                    else:
                        l = k + 1
                return res
        """,
        'O(n log m)',
        'O(1)',
    ),
    (
        'merge two sorted lists',
        """
        class Solution:
            def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
                dummy = ListNode()
                tail = dummy
                while list1 and list2:
                    if list1.val < list2.val:
                        tail.next = list1
                        list1 = list1.next
                    else:
                        tail.next = list2
                        list2 = list2.next
                    tail = tail.next
                tail.next = list1 or list2
                return dummy.next
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'linked list cycle, fast and slow',
        """
        class Solution:
            def hasCycle(self, head: Optional[ListNode]) -> bool:
                slow, fast = head, head
                while fast and fast.next:
                    slow = slow.next
                    fast = fast.next.next
                    if slow == fast:
                        return True
                return False
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'invert binary tree',
        """
        class Solution:
            def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
                if not root:
                    return None
                root.left, root.right = root.right, root.left
                self.invertTree(root.left)
                self.invertTree(root.right)
                return root
        """,
        'O(n)',
        'O(h)',
    ),
    (
        'diameter of binary tree',
        """
        class Solution:
            def diameterOfBinaryTree(self, root: Optional[TreeNode]) -> int:
                res = 0
                def dfs(node):
                    nonlocal res
                    if not node:
                        return 0
                    left = dfs(node.left)
                    right = dfs(node.right)
                    res = max(res, left + right)
                    return 1 + max(left, right)
                dfs(root)
                return res
        """,
        'O(n)',
        'O(h)',
    ),
    (
        'kth smallest in BST, iterative inorder',
        """
        class Solution:
            def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
                stack = []
                cur = root
                while stack or cur:
                    while cur:
                        stack.append(cur)
                        cur = cur.left
                    cur = stack.pop()
                    k -= 1
                    if k == 0:
                        return cur.val
                    cur = cur.right
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'last stone weight, heap',
        """
        class Solution:
            def lastStoneWeight(self, stones: List[int]) -> int:
                stones = [-s for s in stones]
                heapq.heapify(stones)
                while len(stones) > 1:
                    first = heapq.heappop(stones)
                    second = heapq.heappop(stones)
                    if second > first:
                        heapq.heappush(stones, first - second)
                stones.append(0)
                return abs(stones[0])
        """,
        'O(n log n)',
        'O(n)',
    ),
    (
        'subsets, backtracking with a copied path',
        """
        class Solution:
            def subsets(self, nums: List[int]) -> List[List[int]]:
                res = []
                subset = []
                def dfs(i):
                    if i >= len(nums):
                        res.append(subset.copy())
                        return
                    subset.append(nums[i])
                    dfs(i + 1)
                    subset.pop()
                    dfs(i + 1)
                dfs(0)
                return res
        """,
        'O(n·2ⁿ)',
        'O(n·2ⁿ)',
    ),
    (
        'permutations, `in path` on a list',
        """
        class Solution:
            def permute(self, nums: List[int]) -> List[List[int]]:
                res = []
                path = []
                def backtrack():
                    if len(path) == len(nums):
                        res.append(path[:])
                        return
                    for n in nums:
                        if n in path:
                            continue
                        path.append(n)
                        backtrack()
                        path.pop()
                backtrack()
                return res
        """,
        'O(n²·n!)',
        'O(n·n!)',
    ),
    (
        'max area of island, DFS with visited set',
        """
        class Solution:
            def maxAreaOfIsland(self, grid: List[List[int]]) -> int:
                rows, cols = len(grid), len(grid[0])
                visit = set()
                def dfs(r, c):
                    if r < 0 or r == rows or c < 0 or c == cols or grid[r][c] == 0 or (r, c) in visit:
                        return 0
                    visit.add((r, c))
                    return 1 + dfs(r + 1, c) + dfs(r - 1, c) + dfs(r, c + 1) + dfs(r, c - 1)
                area = 0
                for r in range(rows):
                    for c in range(cols):
                        area = max(area, dfs(r, c))
                return area
        """,
        'O(m·n)',
        'O(m·n)',
    ),
    (
        'rotting oranges, multi-source BFS',
        """
        class Solution:
            def orangesRotting(self, grid: List[List[int]]) -> int:
                q = collections.deque()
                fresh = 0
                time = 0
                for r in range(len(grid)):
                    for c in range(len(grid[0])):
                        if grid[r][c] == 1:
                            fresh += 1
                        if grid[r][c] == 2:
                            q.append((r, c))
                directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]
                while fresh > 0 and q:
                    for _ in range(len(q)):
                        r, c = q.popleft()
                        for dr, dc in directions:
                            row, col = r + dr, c + dc
                            if row in range(len(grid)) and col in range(len(grid[0])) and grid[row][col] == 1:
                                grid[row][col] = 2
                                q.append((row, col))
                                fresh -= 1
                    time += 1
                return time if fresh == 0 else -1
        """,
        'O(m·n)',
        'O(m·n)',
    ),
    (
        'clone graph, DFS with a map',
        """
        class Solution:
            def cloneGraph(self, node: Optional["Node"]) -> Optional["Node"]:
                oldToNew = {}
                def dfs(node):
                    if node in oldToNew:
                        return oldToNew[node]
                    copy = Node(node.val)
                    oldToNew[node] = copy
                    for nei in node.neighbors:
                        copy.neighbors.append(dfs(nei))
                    return copy
                return dfs(node) if node else None
        """,
        'O(V + E)',
        'O(V)',
    ),
    (
        'climbing stairs, bottom-up',
        """
        class Solution:
            def climbStairs(self, n: int) -> int:
                one, two = 1, 1
                for i in range(n - 1):
                    temp = one
                    one = one + two
                    two = temp
                return one
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'coin change, bottom-up',
        """
        class Solution:
            def coinChange(self, coins: List[int], amount: int) -> int:
                dp = [amount + 1] * (amount + 1)
                dp[0] = 0
                for a in range(1, amount + 1):
                    for c in coins:
                        if a - c >= 0:
                            dp[a] = min(dp[a], 1 + dp[a - c])
                return dp[amount] if dp[amount] != amount + 1 else -1
        """,
        'O(n·m)',
        'O(m)',
    ),
    (
        'coin change, memoized top-down',
        """
        class Solution:
            def coinChange(self, coins: List[int], amount: int) -> int:
                memo = {}
                def dfs(rem):
                    if rem == 0:
                        return 0
                    if rem < 0:
                        return float("inf")
                    if rem in memo:
                        return memo[rem]
                    res = float("inf")
                    for c in coins:
                        res = min(res, 1 + dfs(rem - c))
                    memo[rem] = res
                    return res
                res = dfs(amount)
                return -1 if res == float("inf") else res
        """,
        'O(n·m)',
        'O(m)',
    ),
    (
        'longest increasing subsequence, O(n²) DP',
        """
        class Solution:
            def lengthOfLIS(self, nums: List[int]) -> int:
                LIS = [1] * len(nums)
                for i in range(len(nums) - 1, -1, -1):
                    for j in range(i + 1, len(nums)):
                        if nums[i] < nums[j]:
                            LIS[i] = max(LIS[i], 1 + LIS[j])
                return max(LIS)
        """,
        'O(n²)',
        'O(n)',
    ),
    (
        'longest common subsequence, 2D DP',
        """
        class Solution:
            def longestCommonSubsequence(self, text1: str, text2: str) -> int:
                dp = [[0 for j in range(len(text2) + 1)] for i in range(len(text1) + 1)]
                for i in range(len(text1) - 1, -1, -1):
                    for j in range(len(text2) - 1, -1, -1):
                        if text1[i] == text2[j]:
                            dp[i][j] = 1 + dp[i + 1][j + 1]
                        else:
                            dp[i][j] = max(dp[i][j + 1], dp[i + 1][j])
                return dp[0][0]
        """,
        'O(n·m)',
        'O(n·m)',
    ),
    (
        'maximum subarray, Kadane',
        """
        class Solution:
            def maxSubArray(self, nums: List[int]) -> int:
                res = nums[0]
                total = 0
                for n in nums:
                    total = max(total, 0) + n
                    res = max(res, total)
                return res
        """,
        'O(n)',
        'O(1)',
    ),
    (
        'merge intervals, sorting by start with a key',
        """
        class Solution:
            def merge(self, intervals: List[List[int]]) -> List[List[int]]:
                intervals.sort(key=lambda pair: pair[0])
                output = [intervals[0]]
                for start, end in intervals:
                    lastEnd = output[-1][1]
                    if start <= lastEnd:
                        output[-1][1] = max(lastEnd, end)
                    else:
                        output.append([start, end])
                return output
        """,
        'O(n log n)',
        'O(n)',
    ),
    (
        'pow(x, n), halving recursion',
        """
        class Solution:
            def myPow(self, x: float, n: int) -> float:
                def helper(x, n):
                    if x == 0:
                        return 0
                    if n == 0:
                        return 1
                    res = helper(x * x, n // 2)
                    return x * res if n % 2 else res
                res = helper(x, abs(n))
                return res if n >= 0 else 1 / res
        """,
        'O(log n)',
        'O(log n)',
    ),
    (
        'number of 1 bits',
        """
        class Solution:
            def hammingWeight(self, n: int) -> int:
                res = 0
                while n:
                    n &= n - 1
                    res += 1
                return res
        """,
        'O(log n)',
        'O(1)',
    ),
    (
        'counting bits',
        """
        class Solution:
            def countBits(self, n: int) -> List[int]:
                dp = [0] * (n + 1)
                offset = 1
                for i in range(1, n + 1):
                    if offset * 2 == i:
                        offset = i
                    dp[i] = 1 + dp[i - offset]
                return dp
        """,
        'O(n)',
        'O(n)',
    ),
    (
        'merge sort',
        """
        class Solution:
            def sortArray(self, nums: List[int]) -> List[int]:
                def merge_sort(arr):
                    if len(arr) <= 1:
                        return arr
                    mid = len(arr) // 2
                    left = merge_sort(arr[:mid])
                    right = merge_sort(arr[mid:])
                    out = []
                    i = j = 0
                    while i < len(left) and j < len(right):
                        if left[i] <= right[j]:
                            out.append(left[i])
                            i += 1
                        else:
                            out.append(right[j])
                            j += 1
                    out.extend(left[i:])
                    out.extend(right[j:])
                    return out
                return merge_sort(nums)
        """,
        'O(n log n)',
        'O(n)',
    ),
    (
        'min stack (design)',
        """
        class MinStack:
            def __init__(self):
                self.stack = []
                self.minStack = []

            def push(self, val: int) -> None:
                self.stack.append(val)
                val = min(val, self.minStack[-1] if self.minStack else val)
                self.minStack.append(val)

            def pop(self) -> None:
                self.stack.pop()
                self.minStack.pop()

            def getMin(self) -> int:
                return self.minStack[-1]
        """,
        'O(1)',
        'O(n)',
    ),
    (
        'word break, DP over prefixes',
        """
        class Solution:
            def wordBreak(self, s: str, wordDict: List[str]) -> bool:
                dp = [False] * (len(s) + 1)
                dp[len(s)] = True
                for i in range(len(s) - 1, -1, -1):
                    for w in wordDict:
                        if i + len(w) <= len(s) and s[i : i + len(w)] == w:
                            dp[i] = dp[i + len(w)]
                        if dp[i]:
                            break
                return dp[0]
        """,
        'O(n·m·p)',
        'O(n)',
    ),
]


def estimate(code: str):
    result = analyze("python3", textwrap.dedent(code))
    assert result is not None
    return result


@pytest.mark.parametrize(("label", "code", "time", "space"), CASES, ids=[c[0] for c in CASES])
def test_evaluation_cases(label, code, time, space):
    result = estimate(code)
    assert result.status == "ok", label
    assert (result.time, result.space) == (time, space), result.reasons


def test_letters_are_explained_and_a_fixed_alphabet_is_spelled_out():
    result = estimate(
        """
        class Solution:
            def isAnagram(self, s: str, t: str) -> bool:
                s_count = {c: s.count(c) for c in set(s)}
                t_count = {c: t.count(c) for c in set(t)}
                return s_count == t_count
        """
    )
    assert (result.time, result.space, result.confidence) == ("O(n·k)", "O(k)", "high")
    assert result.notation.startswith("Where n is the length of `s` and `t`, and k is the number of different characters")
    assert "that's O(n) time and O(1) space" in result.notation
    assert any("goes over `set(s)`: k items, doing O(n) work for each" in r for r in result.reasons)


def test_sizes_that_multiply_stay_apart():
    result = estimate(
        """
        class Solution:
            def f(self, a: str, b: str) -> int:
                return sum(1 for x in a for y in b if x == y)
        """
    )
    assert result.time == "O(n·m)"
    assert "n is the length of `a`, and m is the length of `b`" in result.notation


def test_reasons_point_at_lines():
    result = estimate(CASES[2][1])
    assert any("line " in r for r in result.reasons)


def test_type_hints_make_it_more_confident_than_guessing_from_names():
    hinted = estimate("class Solution:\n    def f(self, nums: List[int]) -> int:\n        return sum(nums)")
    guessed = estimate("class Solution:\n    def f(self, nums):\n        return sum(nums)")
    assert (hinted.time, hinted.confidence) == ("O(n)", "high")
    assert (guessed.time, guessed.confidence) == ("O(n)", "medium")
    assert any("guessed from their names" in limit for limit in guessed.limitations)


def test_a_loop_it_cannot_bound_is_a_ceiling_with_low_confidence():
    result = estimate(
        """
        class Solution:
            def isHappy(self, n: int) -> bool:
                seen = set()
                while n != 1:
                    n = sum(int(d) ** 2 for d in str(n))
                    if n in seen:
                        return False
                    seen.add(n)
                return True
        """
    )
    assert result.bound is True
    assert result.confidence == "low"


def test_a_design_class_lists_each_operation():
    result = estimate(
        """
        class MinStack:
            def __init__(self):
                self.stack = []

            def push(self, val: int) -> None:
                self.stack.append(val)

            def getMin(self) -> int:
                return min(self.stack)
        """
    )
    assert result.time == "O(n)"
    assert result.reasons[0].startswith("This class has several operations")
    assert "push O(1)" in result.reasons[0] and "getMin O(n)" in result.reasons[0]


def test_code_that_isnt_python_is_reported_not_guessed():
    result = estimate("public class Solution { int x; }")
    assert result.status == "unparseable"
    assert result.time is None


def test_other_languages_are_not_supported_yet():
    assert analyze("java", "class Solution {}") is None
    assert analyze("cpp", "int main() {}") is None


def test_deep_nesting_is_refused_rather_than_crashing():
    code = "def f(x):\n    return " + "(" * 5000 + "x" + ")" * 5000
    assert analyze("python3", code).status == "unparseable"


def test_never_crashes_on_odd_code():
    for code in [
        "class Solution:\n    pass",
        "x = 1",
        "def f():\n    while True:\n        break",
        "class Solution:\n    def f(self, a):\n        return [b for b in a if b] + a[::2]",
        "class Solution:\n    def f(self, n: int):\n        return self.f(n - 1) + self.g(n)\n    def g(self, n):\n        return self.f(n)",
        "async def f(x):\n    async for y in x:\n        pass",
        "class Solution:\n    def f(self, s: str):\n        return {**{c: 1 for c in s}}",
    ]:
        assert analyze("python3", code).status in ("ok", "unparseable")
